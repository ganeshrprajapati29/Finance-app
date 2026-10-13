import { Router } from 'express';
import Joi from 'joi';
import Loan from '../models/Loan.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { requireAuth } from '../middlewares/auth.js';
import { uploadToCloudinary } from '../services/cloudinary.js';
import { ok, fail } from '../utils/response.js';
import { notifyUserSmart } from '../services/smartNotifications.js';
import { normalizeAadhaarKycData } from '../utils/aadhaarKyc.js';
import LoanVerification from '../models/LoanVerification.js';
import multer from 'multer';
import { SignCareError, signcareRequestId, verifyBankAccount, verifyUpiName } from '../services/signcare.js';
import {
  AgreementError, agreementView, ensureApprovedAgreementDocument, startAgreementSigning, syncAgreementSignature,
} from '../services/loanAgreementSigning.js';
import loanPolicy from '../config/loanPolicy.js';
import { describeStages, stageLabel, submitBlockingStages } from '../utils/loanVerificationPolicy.js';
import { normalizeSigncarePennyDrop } from '../utils/signcareBankVerification.js';
import { normalizeSigncareUpiName } from '../utils/signcareUpiVerification.js';
import { validateBankAccount } from '../services/clubapiUtility.js';
import { normalizeClubapiBankValidation } from '../utils/clubapiVerification.js';
import { buildUnderwritingSummary } from '../utils/underwritingRisk.js';

// Memory storage for Cloudinary uploads
const memoryStorage = multer.memoryStorage();
const uploadManyMemory = (field='files', max=10) => multer({ storage: memoryStorage, limits:{ fileSize: 10*1024*1024 } }).array(field, max);
const DOCUMENT_UPLOAD_TIMEOUT_MS = 20_000;
const DOCUMENT_UPLOAD_ATTEMPTS = 3;
// Bank + UPI checks inside submit; keeps the whole request under the 60s proxy window.
const VERIFICATION_TIMEOUT_MS = 35_000;
const SUBMIT_LOCK_MS = 90_000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

function uploadDocumentWithTimeout(file) {
  let timer;
  return Promise.race([
    uploadToCloudinary(file.buffer, 'loan-documents'),
    new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(
      new Error('Document upload timed out.'),
      { code: 'DOCUMENT_UPLOAD_TIMEOUT' },
    )), DOCUMENT_UPLOAD_TIMEOUT_MS); }),
  ]).finally(() => clearTimeout(timer));
}

async function uploadDocumentWithRetry(file) {
  let lastError;
  for (let attempt = 1; attempt <= DOCUMENT_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      const result = await uploadDocumentWithTimeout(file);
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < DOCUMENT_UPLOAD_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw Object.assign(lastError || new Error('Document upload failed'), { attempts: DOCUMENT_UPLOAD_ATTEMPTS });
}

/**
 * Uploads the application's documents after the loan is saved and records a
 * per-document status the admin panel can show ("missing" / "failed").
 */
export async function storeLoanDocuments(loanId, files, baseDocuments = {}) {
  const uploadStatus = {};
  const updates = {};
  const results = await Promise.allSettled(files.map((file) => uploadDocumentWithRetry(file)));
  results.forEach((settled, index) => {
    const file = files[index];
    const field = documentFieldFor(file?.originalname) || `unrecognised_${index + 1}`;
    if (settled.status === 'fulfilled' && settled.value.result?.secure_url) {
      if (!field.startsWith('unrecognised_')) updates[`application.documents.${field}`] = settled.value.result.secure_url;
      uploadStatus[field] = { status: 'UPLOADED', filename: file?.originalname || '', attempts: settled.value.attempts, updatedAt: new Date() };
    } else {
      uploadStatus[field] = {
        status: 'FAILED', filename: file?.originalname || '',
        message: settled.reason?.message || 'Document upload failed', attempts: settled.reason?.attempts || DOCUMENT_UPLOAD_ATTEMPTS,
        updatedAt: new Date(),
      };
    }
  });
  const failures = Object.entries(uploadStatus).filter(([, value]) => value.status === 'FAILED');
  if (failures.length) console.warn('Loan document upload partially failed', { loanId: String(loanId), failures: failures.map(([field]) => field) });
  await Loan.updateOne({ _id: loanId }, { $set: {
    ...updates,
    'application.documents.uploadStatus': { ...(baseDocuments.uploadStatus || {}), ...uploadStatus },
    'application.documents.uploadReview': failures.length
      ? { status: 'REVIEW', message: 'Some documents could not be stored. Ask the customer to share them again.', failures: failures.map(([field, value]) => ({ field, filename: value.filename, message: value.message })), capturedAt: new Date() }
      : null,
  } });
  return uploadStatus;
}

// Serialises submits per user so the one-active-loan check and the create
// cannot interleave (double tap, app retry after a timeout).
async function acquireSubmitLock(userId) {
  const now = new Date();
  try {
    const record = await LoanVerification.findOneAndUpdate(
      { userId, $or: [{ submitLockUntil: { $exists: false } }, { submitLockUntil: null }, { submitLockUntil: { $lt: now } }] },
      { $set: { submitLockUntil: new Date(now.getTime() + SUBMIT_LOCK_MS) }, $setOnInsert: { userId, provider: 'SIGNCARE' } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return Boolean(record);
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

const releaseSubmitLock = (userId) =>
  LoanVerification.updateOne({ userId }, { $unset: { submitLockUntil: 1 } }).catch(() => {});

function submitResponse(loan, { reviewRequired = false, repeated = false } = {}) {
  return {
    loanId: loan._id,
    applicationId: loan.loanAccountNumber,
    _id: loan._id,
    id: loan._id,
    loanAccountNumber: loan.loanAccountNumber,
    status: loan.status,
    amountRequested: loan.application?.amountRequested,
    tenureMonths: loan.application?.tenureMonths,
    reviewRequired,
    ...(repeated ? { repeated: true } : {}),
  };
}

function verifyLoanBankAndUpiWithTimeout(options) {
  return Promise.race([
    verifyLoanBankAndUpi(options),
    new Promise((_, reject) => setTimeout(() => reject(Object.assign(
      new Error('Verification providers did not respond in time.'),
      { code: 'VERIFICATION_TIMEOUT' },
    )), VERIFICATION_TIMEOUT_MS)),
  ]);
}

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_PATTERN = /^\d{6,20}$/;
const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const UPI_PATTERN = /^[a-z0-9.\-_]{2,}@[a-z0-9.\-_]{2,}$/i;
const STAGE_LABELS = {
  pan: 'PAN',
  aadhaar: 'Aadhaar/DigiLocker',
  liveness: 'live selfie',
  faceMatch: 'face match',
  bank: 'bank account',
  upi: 'UPI ID',
  credit: 'credit report',
  bankStatement: 'bank statement analysis',
};

/**
 * Classifies an uploaded document from its filename. The Flutter client names
 * each part deliberately (`aadhaar_front.jpg`, `income_proof.pdf`, ...), so
 * matching on that is reliable; anything unrecognised is ignored rather than
 * being written over the Aadhaar front slot.
 * @returns {string|null} the document field, or null when unrecognised
 */
function documentFieldFor(originalName = '') {
  const name = String(originalName).toLowerCase();
  if (name.includes('aadhaar') && name.includes('back')) return 'aadhaarBackUrl';
  if (name.includes('aadhaar')) return 'aadhaarFrontUrl';
  if (name.includes('pan')) return 'panUrl';
  if (name.includes('selfie') || name.includes('photo')) return 'selfieUrl';
  if (name.includes('income') || name.includes('salary') || name.includes('statement')) {
    return 'incomeProofUrl';
  }
  return null;
}

const router = Router();

const nonClosedLoanStatuses = [
  'PENDING', 'UNDER_REVIEW', 'DOCUMENTS_REQUIRED', 'APPROVED',
  'DISBURSEMENT_PROCESSING', 'DISBURSED', 'OVERDUE'
];

function loanOutstanding(loan) {
  const schedule = Array.isArray(loan.schedule) ? loan.schedule : [];
  if (!schedule.length) return loan.status === 'DISBURSED' ? 1 : 0;
  return schedule.reduce((sum, item) => sum + (item.paid ? 0 : Number(item.total || 0)), 0);
}

async function closeIfFullyPaid(loan) {
  if (loan.status !== 'DISBURSED') return loan;
  const schedule = Array.isArray(loan.schedule) ? loan.schedule : [];
  if (schedule.length && schedule.every((item) => item.paid)) {
    loan.status = 'CLOSED';
    loan.statusHistory.push({
      status: 'CLOSED', title: 'Loan closed',
      message: 'All scheduled repayments have been received.', actorType: 'SYSTEM'
    });
    await loan.save();
  }
  return loan;
}

async function getLoanEligibility(userId) {
  const latestActiveLoan = await Loan.findOne({
    userId,
    status: { $in: nonClosedLoanStatuses }
  }).sort({ createdAt: -1 });

  if (!latestActiveLoan) {
    return { eligible: true, message: 'You can apply for a new loan.' };
  }

  const loan = await closeIfFullyPaid(latestActiveLoan);
  if (loan.status === 'CLOSED') {
    return { eligible: true, message: 'Previous loan is closed. You can apply for a new loan.' };
  }

  const outstandingAmount = loanOutstanding(loan);
  const messages = {
    PENDING: 'Your existing loan application is under review.',
    UNDER_REVIEW: 'Your existing loan application is under review.',
    DOCUMENTS_REQUIRED: 'Please complete the requested documents for your existing application.',
    APPROVED: 'Your approved loan is awaiting disbursement.',
    DISBURSEMENT_PROCESSING: 'Your approved loan disbursement is being processed.',
    DISBURSED: 'You already have an active loan. Please close it before applying again.',
    OVERDUE: 'Please clear the overdue amount on your active loan before applying again.'
  };

  return {
    eligible: false,
    code: 'ACTIVE_LOAN_EXISTS',
    message: messages[loan.status] || 'You can apply for a new loan.',
    loan: {
      _id: loan._id,
      loanAccountNumber: loan.loanAccountNumber,
      status: loan.status,
      outstandingAmount
    }
  };
}

async function verifyLoanBankAndUpi({ userId, mobile, bankDetails }) {
  const verification = await LoanVerification.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, provider: 'SIGNCARE' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const sameBank =
    String(verification.bank?.data?.accountNumber || '') === String(bankDetails.accountNumber || '') &&
    String(verification.bank?.data?.ifscCode || '').toUpperCase() === String(bankDetails.ifscCode || '').toUpperCase();
  let bankValidation;
  let bankProviders = [];
  if (sameBank && ['VERIFIED', 'REVIEW'].includes(String(verification.bank?.status || '').toUpperCase())) {
    bankValidation = {
      ...(verification.bank.data || {}),
      status: verification.bank.status,
      isValid: verification.bank.status === 'VERIFIED',
      message: verification.bank.message || verification.bank.data?.message || 'Bank details already verified.',
    };
    bankProviders = verification.bank.data?.providersAttempted ||
      (verification.bank.data?.provider ? [verification.bank.data.provider] : []);
  } else {
    bankProviders = ['SIGNCARE'];
    const bankRequestId = signcareRequestId('KP-LOAN-BANK-PENNYDROP');
    let bankResult;
    try {
      bankResult = await verifyBankAccount({
        accountNumber: bankDetails.accountNumber,
        ifsc: bankDetails.ifscCode,
        consentText: 'I consent to Khatu Pay verifying my bank account through SignCare Penny Drop Basic for loan eligibility assessment.',
        requestId: bankRequestId,
      });
    } catch (error) {
      if (!(error instanceof SignCareError)) throw error;
      const message = `Bank details submitted for Khatu Pay review. IFSC ${String(bankDetails.ifscCode).toUpperCase()}, account ending ${String(bankDetails.accountNumber).slice(-4)}.`;
      bankValidation = {
        accountNumber: String(bankDetails.accountNumber || ''),
        ifscCode: String(bankDetails.ifscCode || '').toUpperCase(),
        status: 'REVIEW',
        isValid: false,
        message,
        providerError: error.data || null,
        provider: 'SIGNCARE_PENNY_DROP_BASIC',
      };
      verification.bank = {
        status: 'REVIEW',
        requestId: bankRequestId,
        message,
        updatedAt: new Date(),
        data: { ...bankValidation, provider: 'SIGNCARE_PENNY_DROP_BASIC', reviewReason: 'PROVIDER_UNAVAILABLE' },
      };
      await verification.save();
    }
    if (bankResult) {
      bankValidation = normalizeSigncarePennyDrop(bankResult.response, {
        accountNumber: bankDetails.accountNumber,
        ifsc: bankDetails.ifscCode,
      });
      bankValidation.provider = 'SIGNCARE_PENNY_DROP_BASIC';
      verification.bank = {
        status: bankValidation.isValid ? 'VERIFIED' : 'FAILED',
        requestId: bankResult.requestId || bankRequestId,
        providerReference: bankValidation.requestId || bankResult.requestId || bankRequestId,
        message: bankValidation.message,
        ...(bankValidation.isValid ? { verifiedAt: new Date() } : {}),
        updatedAt: new Date(),
        data: { ...bankValidation, provider: 'SIGNCARE_PENNY_DROP_BASIC' },
      };
      if (!bankValidation.isValid) {
        const temporary = /max\s*retries|timeout|timed\s*out/i.test(`${bankValidation.bankResponse} ${bankValidation.message}`);
        const last4 = String(bankDetails.accountNumber).slice(-4);
        if (temporary) {
          const message = `Bank details submitted for Khatu Pay review. IFSC ${String(bankDetails.ifscCode).toUpperCase()}, account ending ${last4}.`;
          verification.bank = {
            ...verification.bank,
            status: 'REVIEW',
            message,
            updatedAt: new Date(),
            data: { ...bankValidation, provider: 'SIGNCARE_PENNY_DROP_BASIC', reviewReason: 'PROVIDER_RETRY_LIMIT' },
          };
          bankValidation.status = 'REVIEW';
          bankValidation.message = message;
          await verification.save();
        } else {
          const message = `Bank details submitted for Khatu Pay review. IFSC ${String(bankDetails.ifscCode).toUpperCase()}, account ending ${String(bankDetails.accountNumber).slice(-4)}.`;
          verification.bank = {
            ...verification.bank,
            status: 'REVIEW',
            message,
            updatedAt: new Date(),
            data: { ...bankValidation, provider: 'SIGNCARE_PENNY_DROP_BASIC', reviewReason: 'SIGNCARE_VERIFICATION_FAILED' },
          };
          bankValidation.status = 'REVIEW';
          bankValidation.message = message;
          await verification.save();
        }
      }
    }
  }

  // The wizard validates the same account before the final submit. Reuse a
  // verified result with a resolved name instead of charging/calling providers
  // again during application creation.
  if (sameBank && bankValidation?.isValid && bankValidation.accountName && bankValidation.bankName) {
    bankValidation.providerUsed = bankValidation.providerUsed || 'CACHED_VERIFICATION';
  }

  // SignCare can return a valid penny-drop result without echoing the
  // beneficiary or bank name. Use ClubAPI's bank validation as a best-effort
  // enrichment fallback, without downgrading an already-valid SignCare result
  // if ClubAPI is unavailable.
  if (!bankValidation?.isValid || !bankValidation.accountName || !bankValidation.bankName) {
    try {
      const clubapiResponse = await validateBankAccount({
        customerMobile: String(mobile || '').replace(/\D/g, '').slice(-10),
        accountNumber: bankDetails.accountNumber,
        ifscCode: bankDetails.ifscCode,
      });
      const clubapiValidation = normalizeClubapiBankValidation(clubapiResponse, {
        accountNumber: bankDetails.accountNumber,
        ifscCode: bankDetails.ifscCode,
      });
      if (!clubapiValidation.isValid) {
        throw new Error(clubapiValidation.message || 'ClubAPI bank validation failed.');
      }
      const signcareWasValid = Boolean(bankValidation?.isValid);
      bankValidation = {
        ...bankValidation,
        ...clubapiValidation,
        ...(clubapiValidation.accountName ? { accountName: clubapiValidation.accountName, beneficiaryName: clubapiValidation.accountName } : {}),
        ...(clubapiValidation.bankName ? { bankName: clubapiValidation.bankName } : {}),
        fallbackProvider: 'CLUBAPI',
        fallbackValidation: clubapiValidation,
        providerUsed: signcareWasValid ? 'SIGNCARE+CLUBAPI' : 'CLUBAPI',
        providersAttempted: [...new Set([...bankProviders, 'CLUBAPI'])],
      };
      verification.bank = {
        ...(verification.bank?.toObject?.() || verification.bank || {}),
        status: 'VERIFIED',
        message: bankValidation.accountName
          ? `Bank account verified for ${bankValidation.accountName}.`
          : verification.bank?.message || bankValidation.message,
        updatedAt: new Date(),
        data: { ...(verification.bank?.data || {}), ...bankValidation },
      };
      await verification.save();
    } catch (fallbackError) {
      console.warn('ClubAPI bank-name fallback unavailable:', fallbackError.message);
      if (!bankValidation?.isValid) {
        const message = `Bank details submitted for Khatu Pay review. IFSC ${String(bankDetails.ifscCode).toUpperCase()}, account ending ${String(bankDetails.accountNumber).slice(-4)}.`;
        bankValidation = {
          ...bankValidation,
          status: 'REVIEW',
          isValid: false,
          message,
          fallbackProvider: 'CLUBAPI',
          fallbackError: fallbackError.message,
          providerUsed: bankValidation?.providerUsed || 'SIGNCARE+CLUBAPI',
          providersAttempted: [...new Set([...bankProviders, 'CLUBAPI'])],
        };
        verification.bank = {
          ...(verification.bank?.toObject?.() || verification.bank || {}),
          status: 'REVIEW',
          message,
          updatedAt: new Date(),
          data: { ...(verification.bank?.data || {}), ...bankValidation, reviewReason: 'BOTH_PROVIDERS_UNAVAILABLE' },
        };
        await verification.save();
      }
    }
  }

  const upiId = String(bankDetails.upiId || '').trim().toLowerCase();
  if (!upiId) {
    return {
      verification,
      bankValidation,
      upiValidation: {
        status: 'SKIPPED',
        isValid: false,
        message: 'UPI verification was not requested for this loan application.',
      },
    };
  }
  const sameUpi = String(verification.upi?.data?.upiId || '').toLowerCase() === upiId;
  let upiValidation;
  if (sameUpi && verification.upi?.status === 'VERIFIED') {
    upiValidation = {
      ...(verification.upi.data || {}),
      status: 'VERIFIED',
      isValid: true,
      message: verification.upi.message || verification.upi.data?.message || 'UPI ID already verified.',
    };
  } else {
    const upiRequestId = signcareRequestId('KP-LOAN-UPI-SIGNCARE');
    let upiResult;
    try {
      upiResult = await verifyUpiName({
        upiId,
        consentText: 'I consent to Khatu Pay verifying my UPI ID through SignCare for loan eligibility assessment.',
        requestId: upiRequestId,
      });
    } catch (error) {
      if (!(error instanceof SignCareError)) throw error;
      upiValidation = {
        upiId,
        status: 'REVIEW',
        isValid: false,
        message: 'UPI ID submitted for Khatu Pay review.',
        providerError: error.data || null,
      };
      verification.upi = {
        status: 'REVIEW',
        requestId: upiRequestId,
        message: upiValidation.message,
        updatedAt: new Date(),
        data: { ...upiValidation, provider: 'SIGNCARE_UPI_ID_TO_NAME', reviewReason: 'PROVIDER_UNAVAILABLE' },
      };
      await verification.save();
    }
    if (upiResult) {
    upiValidation = normalizeSigncareUpiName(upiResult.response, { upiId });
    verification.upi = {
      status: upiValidation.isValid ? 'VERIFIED' : 'FAILED',
      requestId: upiResult.requestId || upiRequestId,
      providerReference: upiValidation.requestId || upiResult.requestId || upiRequestId,
      message: upiValidation.message,
      ...(upiValidation.isValid ? { verifiedAt: new Date() } : {}),
      updatedAt: new Date(),
      data: { ...upiValidation, provider: 'SIGNCARE_UPI_ID_TO_NAME' },
    };
    await verification.save();
    if (!upiValidation.isValid) {
      throw Object.assign(new Error(upiValidation.message), {
        status: 400,
        code: 'UPI_VERIFICATION_FAILED',
        data: upiValidation,
      });
    }
    }
  }

  await verification.save();
  return { verification, bankValidation, upiValidation };
}

async function hydrateIdentityVerificationFromUserKyc(verification, user) {
  let changed = false;
  if (verification.pan?.status !== 'VERIFIED' && user?.kyc?.panVerified === true) {
    verification.pan = {
      status: 'VERIFIED',
      requestId: verification.pan?.requestId || signcareRequestId('KP-SAVED-PAN'),
      message: 'PAN verified from saved KYC.',
      verifiedAt: user.kyc.panVerification?.verifiedAt || verification.pan?.verifiedAt || new Date(),
      updatedAt: new Date(),
      data: user.kyc.panData || user.kyc.panVerification?.response || {},
    };
    changed = true;
  }
  if (verification.aadhaar?.status !== 'VERIFIED' && user?.kyc?.aadhaarVerified === true) {
    verification.aadhaar = {
      status: 'VERIFIED',
      requestId: verification.aadhaar?.requestId || signcareRequestId('KP-SAVED-AADHAAR'),
      providerReference: verification.aadhaar?.providerReference || user.kyc.aadhaarVerification?.transactionId || user.kyc.aadhaarVerification?.txnId || '',
      message: 'Identity verified from saved KYC.',
      verifiedAt: user.kyc.aadhaarVerification?.verifiedAt || verification.aadhaar?.verifiedAt || new Date(),
      updatedAt: new Date(),
      data: user.kyc.aadhaarData || user.kyc.aadhaarVerification?.response || {},
    };
    changed = true;
  }
  if (changed) await verification.save();
  return verification;
}

async function generateLoanAccountNumber() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
    const alreadyUsed = await Loan.exists({ loanAccountNumber: candidate });
    if (!alreadyUsed) return candidate;
  }
  throw Object.assign(new Error('Could not reserve a unique application number.'), {
    status: 503,
    code: 'APPLICATION_NUMBER_UNAVAILABLE',
  });
}

// Only a provider outage may turn into a manual-review application. Anything
// else (validation, database, programming errors) must surface, so a bug can
// never create a loan that skipped the verification policy.
function canQueueLoanForReview(error) {
  if (!error || error.isJoi || error.name === 'CastError') return false;
  if (error.code === 11000 || error.code === 'APPLICATION_NUMBER_UNAVAILABLE') return false;
  if (Number(error.status) >= 400 && Number(error.status) < 500) return false;
  if (/mongo|mongoose|database|topology|bson/i.test(`${error.name} ${error.message}`)) return false;
  return error instanceof SignCareError ||
    /TIMEOUT|UNAVAILABLE|PROVIDER|ECONNRESET|ECONNREFUSED|ETIMEDOUT/i.test(String(error.code || ''));
}

// Create loan application (wizard or simple)
router.post('/', requireAuth, uploadManyMemory('files', 10), async (req, res, next) => {
  let validatedPayload = null;
  let authenticatedUser = null;
  let createdLoan = null;
  let lockHeld = false;
  const userId = req.user.uid;
  const idempotencyKey = String(req.get('Idempotency-Key') || '').trim();
  if (idempotencyKey && !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return fail(res, 'INVALID_IDEMPOTENCY_KEY', 'Invalid request key. Please restart the application.', 400);
  }
  try {
    // A resubmit of the same draft (double tap, retry after a network drop)
    // returns the loan that already exists instead of creating a second one.
    if (idempotencyKey) {
      const existing = await Loan.findOne({ userId, idempotencyKey });
      if (existing) {
        return ok(res, submitResponse(existing, { repeated: true }), 'Your application was already submitted.', {
          code: 'LOAN_APPLICATION_SUBMITTED', status: 200,
        });
      }
    }

    lockHeld = await acquireSubmitLock(userId);
    if (!lockHeld) {
      return fail(res, 'APPLICATION_IN_PROGRESS', 'Your application is already being submitted. Please wait a moment.', 409);
    }

    const eligibility = await getLoanEligibility(userId);
    if (!eligibility.eligible) {
      return fail(
        res,
        eligibility.code || 'NOT_ELIGIBLE',
        eligibility.message,
        409,
        { loan: eligibility.loan || null }
      );
    }

    const schema = Joi.object({
      // wizard payload
      personal: Joi.object({
        name: Joi.string().trim().required(),
        email: Joi.string().trim().email().allow('').default(''),
        mobile: Joi.string().trim().allow('').default(''),
        address: Joi.string().allow('').default(''),
        fatherName: Joi.string().allow(''),
        motherName: Joi.string().allow(''),
      }).optional(),
      qualification: Joi.object({
        highestEducation: Joi.string().allow(''),
        stream: Joi.string().allow(''),
        institution: Joi.string().allow(''),
      }).optional(),
      employment: Joi.object({
        employmentType: Joi.string().allow(''),
        monthlyIncome: Joi.number().min(0).default(0),
        employerOrBusiness: Joi.string().allow(''),
        experienceYears: Joi.number().min(0).default(0),
      }).optional(),
      documents: Joi.object({
        aadhaarFrontUrl: Joi.string().allow(null,''),
        aadhaarBackUrl: Joi.string().allow(null,''),
        panUrl: Joi.string().allow(null,''),
        selfieUrl: Joi.string().allow(null,''),
        incomeProofUrl: Joi.string().allow(null,''),
        incomeProofType: Joi.string().valid('SALARY_SLIP', 'BANK_STATEMENT', 'OTHER').allow(null,''),
      }).optional(),
      references: Joi.array().items(Joi.object({
        name: Joi.string().allow(''),
        relation: Joi.string().allow(''),
        mobile: Joi.string().allow('')
      })).default([]),
      bankDetails: Joi.object({
        bankName: Joi.string().allow('').default(''),
        accountNumber: Joi.string().trim().pattern(ACCOUNT_PATTERN).required().messages({
          'string.pattern.base': 'Enter a valid bank account number (6-20 digits).',
          'any.required': 'Bank account number is required.',
        }),
        ifscCode: Joi.string().trim().uppercase().pattern(IFSC_PATTERN).required().messages({
          'string.pattern.base': 'Enter a valid 11-character IFSC code.',
          'any.required': 'IFSC code is required.',
        }),
        accountHolderName: Joi.string().allow('').default(''),
        upiId: Joi.string().trim().lowercase().pattern(UPI_PATTERN).allow('').default('').messages({
          'string.pattern.base': 'Enter a valid UPI ID, for example name@bank.',
        }),
        upiAccountName: Joi.string().allow('').default(''),
      }).required(),
      amountRequested: Joi.number().min(loanPolicy.minAmount).max(loanPolicy.maxAmount).required().messages({
        'number.min': `Minimum loan amount is Rs. ${loanPolicy.minAmount.toLocaleString('en-IN')}.`,
        'number.max': `Maximum loan amount is Rs. ${loanPolicy.maxAmount.toLocaleString('en-IN')}.`,
        'any.required': 'Loan amount is required.',
      }),
      tenureMonths: Joi.number().integer().min(loanPolicy.minTenureMonths).max(loanPolicy.maxTenureMonths).required().messages({
        'number.min': `Minimum tenure is ${loanPolicy.minTenureMonths} months.`,
        'number.max': `Maximum tenure is ${loanPolicy.maxTenureMonths} months.`,
        'any.required': 'Loan tenure is required.',
      }),
      purpose: Joi.string().allow('').default('Personal'),
      consents: Joi.object({
        creditReport: Joi.boolean().valid(true).required(),
        terms: Joi.boolean().valid(true).required(),
        privacy: Joi.boolean().valid(true).required(),
        version: Joi.string().max(40).default('2026-09-19')
      }).required().messages({
        'any.required': 'Please accept the loan terms, privacy notice and credit report consent.',
        'any.only': 'Please accept all required consents before submitting.'
      }),
      // simple mode
      docs: Joi.array().items(Joi.string()).optional(),
    });

    // Wizard submissions arrive as multipart: a `payload` JSON field plus the
    // document files. Simple submissions post plain JSON.
    let requestBody = req.body;
    if (req.body?.payload) {
      try {
        requestBody = JSON.parse(req.body.payload);
      } catch {
        return fail(
          res,
          'INVALID_PAYLOAD',
          'Your application data could not be read. Please try submitting again.',
          400
        );
      }
    }

    // abortEarly:false so the client can surface everything wrong at once
    // instead of one field per round trip. Client-computed validation results
    // are stripped: only the server's own checks are stored.
    const payload = await schema.validateAsync(requestBody, {
      abortEarly: false,
      stripUnknown: true,
    });
    validatedPayload = payload;

    const user = await User.findById(userId).select('kyc mobile');
    authenticatedUser = user;
    if (payload.personal) {
      const mobile = String(payload.personal.mobile || '').replace(/\D/g, '').slice(-10);
      payload.personal.mobile = MOBILE_PATTERN.test(mobile) ? mobile : String(user?.mobile || '').replace(/\D/g, '').slice(-10);
    }

    const uploadedFields = new Set((req.files || []).map((file) => documentFieldFor(file.originalname)).filter(Boolean));
    if (loanPolicy.requireSelfieDocument && !uploadedFields.has('selfieUrl') && !payload.documents?.selfieUrl) {
      return fail(res, 'SELFIE_REQUIRED', 'Please add your selfie before submitting.', 400);
    }
    if (loanPolicy.requireIncomeProof && !uploadedFields.has('incomeProofUrl') && !payload.documents?.incomeProofUrl) {
      return fail(res, 'INCOME_PROOF_REQUIRED', 'Please upload your income proof before submitting.', 400);
    }

    let verificationFailure = null;
    try {
      const validation = await verifyLoanBankAndUpiWithTimeout({
        userId,
        mobile: payload.personal?.mobile || user?.mobile,
        bankDetails: payload.bankDetails,
      });
      payload.bankDetails.bankValidation = validation.bankValidation;
      payload.bankDetails.upiValidation = validation.upiValidation;
      if (validation.bankValidation.accountName) {
        payload.bankDetails.accountHolderName = validation.bankValidation.accountName;
      } else if (!payload.bankDetails.accountHolderName && validation.bankValidation.status === 'REVIEW') {
        payload.bankDetails.accountHolderName = 'Pending Khatu Pay review';
      }
      if (validation.bankValidation.bankName && !payload.bankDetails.bankName) {
        payload.bankDetails.bankName = validation.bankValidation.bankName;
      }
      if (validation.upiValidation?.accountName) {
        payload.bankDetails.upiAccountName = validation.upiValidation.accountName;
      }
    } catch (verificationError) {
      // A UPI ID the provider says does not exist is the customer's to fix.
      if (verificationError.code === 'UPI_VERIFICATION_FAILED') throw verificationError;
      // Provider outages must not discard a completed loan form. Save it for
      // manual review and expose the failure only in the admin verification
      // snapshot, never as a false application failure to the customer.
      verificationFailure = {
        code: verificationError.code || 'VERIFICATION_UNAVAILABLE',
        message: verificationError.message || 'Verification could not be completed automatically.',
        capturedAt: new Date(),
      };
      console.warn('Loan bank/UPI verification unavailable at submit', { userId: String(userId), code: verificationFailure.code });
      payload.bankDetails.bankValidation = {
        status: 'REVIEW',
        isValid: false,
        message: 'Bank verification will be completed by Khatu Pay review team.',
      };
      payload.bankDetails.upiValidation = {
        status: payload.bankDetails.upiId ? 'REVIEW' : 'SKIPPED',
        isValid: false,
        message: payload.bankDetails.upiId
          ? 'UPI verification will be completed by Khatu Pay review team.'
          : 'UPI verification was not requested for this loan application.',
      };
      if (!payload.bankDetails.accountHolderName) {
        payload.bankDetails.accountHolderName = 'Pending Khatu Pay review';
      }
    }

    // Always read the stored stages fresh: the bank/UPI step above may have
    // updated them, or timed out before it could.
    let verificationDoc = await LoanVerification.findOne({ userId });
    if (verificationDoc) verificationDoc = await hydrateIdentityVerificationFromUserKyc(verificationDoc, user);
    const signcareVerification = verificationDoc?.toObject?.() || {};
    if (verificationFailure) {
      // The outage is recorded for review; it must not read as "not started".
      for (const stage of ['bank', ...(payload.bankDetails.upiId ? ['upi'] : [])]) {
        if (!['VERIFIED', 'REVIEW'].includes(String(signcareVerification[stage]?.status || '').toUpperCase())) {
          signcareVerification[stage] = { ...(signcareVerification[stage] || {}), status: 'REVIEW', message: 'Provider unavailable at submit; Khatu Pay will review.' };
        }
      }
    }
    if (payload.documents?.incomeProofType === 'BANK_STATEMENT' &&
        signcareVerification?.bankStatement?.status !== 'VERIFIED') {
      payload.documents.incomeProofType = 'OTHER';
    }
    const policyInput = { upiId: payload.bankDetails.upiId, incomeProofType: payload.documents?.incomeProofType };
    const incompleteStages = submitBlockingStages(signcareVerification, policyInput);
    if (incompleteStages.length && loanPolicy.requireKycAtSubmit) {
      return fail(
        res,
        'SIGNCARE_VERIFICATION_REQUIRED',
        `Please complete ${describeStages(incompleteStages)} before submitting.`,
        409,
        { stages: incompleteStages, incompleteStages: incompleteStages.map(stageLabel) },
      );
    }
    const reviewStages = ['pan', 'aadhaar', 'liveness', 'faceMatch', 'bank', 'upi', 'credit', 'bankStatement'].filter((stage) =>
      String(signcareVerification[stage]?.status || '').toUpperCase() === 'REVIEW');

    const documents = { ...(payload.documents || {}) };
    const aadhaarData = normalizeAadhaarKycData(
      user.kyc?.aadhaarVerification?.response || user.kyc?.aadhaarData?.raw || user.kyc?.aadhaarData,
      user.kyc?.aadhaarData
    );
    // The stored photo and raw provider payload stay in the KYC record.
    const { photoBase64, raw, ...aadhaarSummary } = aadhaarData || {};
    documents.aadhaarEkyc = {
      verified: String(signcareVerification.aadhaar?.status || '').toUpperCase() === 'VERIFIED',
      status: signcareVerification.aadhaar?.status || 'NOT_STARTED',
      aadhaarNumber: user.kyc?.aadhaarNumber,
      aadhaarMobile: user.kyc?.aadhaarMobile,
      verifiedAt: signcareVerification.aadhaar?.verifiedAt || user.kyc?.aadhaarVerification?.verifiedAt,
      orderId: user.kyc?.aadhaarVerification?.orderId,
      aadhaarData: aadhaarSummary
    };
    documents.panVerification = {
      verified: String(signcareVerification.pan?.status || '').toUpperCase() === 'VERIFIED',
      status: signcareVerification.pan?.status || 'NOT_STARTED',
      panNumber: user.kyc?.panNumber,
      panName: user.kyc?.panName,
      verifiedAt: signcareVerification.pan?.verifiedAt || user.kyc?.panVerification?.verifiedAt,
      orderId: user.kyc?.panVerification?.orderId,
      panData: user.kyc?.panData,
    };
    documents.incomeProofType = payload.documents?.incomeProofType || 'OTHER';
    if (req.files?.length) {
      documents.uploadStatus = Object.fromEntries(req.files.map((file, index) => [
        documentFieldFor(file.originalname) || `unrecognised_${index + 1}`,
        { status: 'UPLOADING', filename: file.originalname, updatedAt: new Date() },
      ]));
    }

    const references = Array.isArray(payload.references)
      ? payload.references.filter((ref) => ref?.name || ref?.relation || ref?.mobile)
      : [];

    const loanAccountNumber = await generateLoanAccountNumber();

    const verificationSnapshot = Object.fromEntries(
      ['pan', 'aadhaar', 'liveness', 'faceMatch', 'bank', 'upi', 'bankStatement', 'credit', 'accountAggregator', 'agreement', 'eStamp', 'eSign', 'auditTrail']
        .map((key) => [key, {
          status: signcareVerification[key]?.status || 'NOT_STARTED',
          requestId: signcareVerification[key]?.requestId || '',
          providerReference: signcareVerification[key]?.providerReference || '',
          message: signcareVerification[key]?.message || '',
          requiresReview: incompleteStages.includes(key) || reviewStages.includes(key),
          verifiedAt: signcareVerification[key]?.verifiedAt || null,
        }])
    );
    const underwriting = buildUnderwritingSummary({
      loan: { application: { ...payload, documents, references, bankDetails: payload.bankDetails } },
      verification: signcareVerification,
    });
    const consent = { accepted: true, acceptedAt: new Date(), version: payload.consents.version, ipAddress: req.ip, userAgent: req.get('user-agent') || '' };

    createdLoan = await Loan.create({
      userId,
      loanAccountNumber: loanAccountNumber,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      application: {
        amountRequested: payload.amountRequested,
        tenureMonths: payload.tenureMonths,
        purpose: payload.purpose,
        personal: payload.personal,
        qualification: payload.qualification,
        employment: payload.employment,
        documents: documents,
        references,
        bankDetails: payload.bankDetails,
      },
      status: 'PENDING',
      consents: { creditReport: consent, terms: consent, privacy: consent },
      verification: {
        provider: 'SIGNCARE',
        verificationId: verificationDoc?._id,
        snapshot: {
          ...verificationSnapshot,
          incompleteStages,
          reviewStages,
          underwriting,
          ...(verificationFailure ? { verificationFailure } : {}),
        },
        capturedAt: new Date(),
      },
      statusHistory: [{
        status: 'PENDING',
        title: 'Application submitted',
        message: 'Your application was received and is awaiting review.',
        actorType: 'USER',
        actorId: userId
      }]
    });
    const loan = createdLoan;

    // The loan is saved before contacting Cloudinary, so a document upload
    // outage cannot turn a valid application into a failed request. Each
    // document's result is recorded for the admin panel.
    if (req.files && req.files.length > 0) {
      void storeLoanDocuments(loan._id, req.files, documents)
        .catch((uploadError) => console.error('Loan document processing failed', uploadError));
    }

    // Notifications are best-effort. The loan is already persisted at this
    // point, so a push/notification outage must not turn a successful
    // application into an error the user is asked to retry - which would
    // create a duplicate loan.
    try {
      await Notification.create({
        userId,
        title: 'New Loan Application Submitted',
        message: `${payload.personal?.name || 'A user'} has submitted a loan application for Rs. ${payload.amountRequested} for ${payload.tenureMonths} months`,
        type: 'loan',
        priority: 'HIGH',
        data: {
          loanId: loan._id,
          loanAccountNumber,
          amountRequested: payload.amountRequested,
          tenureMonths: payload.tenureMonths,
          userName: payload.personal?.name,
          userEmail: payload.personal?.email
        }
      });

      await notifyUserSmart(userId, 'loan_application_submitted', {
        persist: false,
        loanId: loan._id,
        amount: payload.amountRequested,
        data: {
          loanId: String(loan._id),
          loanAccountNumber,
          amountRequested: payload.amountRequested,
          tenureMonths: payload.tenureMonths,
        },
      });
    } catch (notifyError) {
      console.error('Loan application notification failed', notifyError);
    }

    const reviewRequired = Boolean(verificationFailure) || reviewStages.length > 0;
    ok(
      res,
      submitResponse(loan, { reviewRequired }),
      reviewRequired
        ? 'Loan application submitted. Khatu Pay will review a few details before the decision.'
        : 'Loan application submitted. Our team will review it shortly.',
      {
        code: reviewRequired
          ? 'LOAN_APPLICATION_REVIEW_REQUIRED'
          : 'LOAN_APPLICATION_SUBMITTED',
        status: 201,
      }
    );
  } catch (e) {
    // The loan already exists: report success rather than risk a duplicate.
    if (createdLoan) {
      console.error('Loan post-create processing failed', { loanId: String(createdLoan._id), message: e.message });
      return ok(res, submitResponse(createdLoan, { reviewRequired: true }), 'Loan application submitted. Our team will review it shortly.', {
        code: 'LOAN_APPLICATION_SUBMITTED', status: 201,
      });
    }
    // A duplicate idempotency key means a parallel request won the race.
    if (e?.code === 11000 && idempotencyKey) {
      const existing = await Loan.findOne({ userId, idempotencyKey }).catch(() => null);
      if (existing) {
        return ok(res, submitResponse(existing, { repeated: true }), 'Your application was already submitted.', {
          code: 'LOAN_APPLICATION_SUBMITTED', status: 200,
        });
      }
    }
    // Once the form has passed validation, a provider/processing failure (not a
    // database, auth, duplicate or invalid-data error) is saved as a pending
    // record for admin review instead of a false client failure.
    if (validatedPayload && authenticatedUser && canQueueLoanForReview(e)) {
      const ref = signcareRequestId('KP-LOAN-FALLBACK');
      console.error('Loan application processing failed; saving for manual review', { ref, userId: String(userId), code: e.code, message: e.message });
      try {
        const loanAccountNumber = await generateLoanAccountNumber();
        const reviewLoan = await Loan.create({
          userId,
          loanAccountNumber,
          ...(idempotencyKey ? { idempotencyKey } : {}),
          application: {
            amountRequested: validatedPayload.amountRequested,
            tenureMonths: validatedPayload.tenureMonths,
            purpose: validatedPayload.purpose,
            personal: validatedPayload.personal,
            qualification: validatedPayload.qualification,
            employment: validatedPayload.employment,
            documents: { incomeProofType: validatedPayload.documents?.incomeProofType || 'OTHER' },
            references: validatedPayload.references || [],
            bankDetails: {
              ...validatedPayload.bankDetails,
              accountHolderName: validatedPayload.bankDetails.accountHolderName || 'Pending Khatu Pay review',
              bankValidation: { status: 'REVIEW', message: 'Verification will be completed by the Khatu Pay review team.' },
              upiValidation: { status: 'REVIEW', message: 'Verification will be completed by the Khatu Pay review team.' },
            },
          },
          status: 'PENDING',
          consents: {
            creditReport: { accepted: true, acceptedAt: new Date(), version: validatedPayload.consents.version, ipAddress: req.ip },
            terms: { accepted: true, acceptedAt: new Date(), version: validatedPayload.consents.version, ipAddress: req.ip },
            privacy: { accepted: true, acceptedAt: new Date(), version: validatedPayload.consents.version, ipAddress: req.ip },
          },
          verification: {
            provider: 'SIGNCARE',
            snapshot: {
              fallback: true,
              reviewRequired: true,
              failureRef: ref,
              failureCode: e.code || 'APPLICATION_PROCESSING_FAILED',
              failureMessage: 'Automatic processing was incomplete; manual review is required.',
              capturedAt: new Date(),
            },
            capturedAt: new Date(),
          },
          statusHistory: [{
            status: 'PENDING',
            title: 'Application submitted for manual review',
            message: 'The application was saved after automatic processing was incomplete.',
            actorType: 'USER',
            actorId: userId,
          }],
        });
        if (req.files?.length) {
          void storeLoanDocuments(reviewLoan._id, req.files).catch((uploadError) => console.error('Loan document processing failed', uploadError));
        }
        return ok(res, submitResponse(reviewLoan, { reviewRequired: true }), 'Loan application submitted for Khatu Pay manual review.', {
          code: 'LOAN_APPLICATION_REVIEW_REQUIRED',
          status: 201,
        });
      } catch (fallbackError) {
        console.error('Loan manual-review fallback failed', { ref, message: fallbackError.message });
      }
    }
    next(e);
  } finally {
    if (lockHeld) await releaseSubmitLock(userId);
  }
});

router.get('/eligibility/status', requireAuth, async (req, res, next) => {
  try {
    const eligibility = await getLoanEligibility(req.user.uid);
    ok(res, eligibility);
  } catch (e) { next(e); }
});

// list my loans
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await Loan.find({ userId: req.user.uid }).sort({ createdAt: -1 });
    ok(res, rows);
  } catch (e) { next(e); }
});

function agreementFailure(res, error) {
  if (error instanceof AgreementError) return fail(res, error.code, error.message, error.status);
  if (error instanceof SignCareError) {
    return fail(res, 'SIGNCARE_REQUEST_FAILED', 'Signing service is busy right now. Please try again in a moment.', error.status >= 500 ? 503 : 422);
  }
  return null;
}

router.get('/:id/agreement', requireAuth, async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    if (loan.status === 'APPROVED' && agreementView(loan).status !== 'SIGNED') {
      const borrower = await User.findById(req.user.uid).select('name email mobile').lean();
      await ensureApprovedAgreementDocument(loan, borrower);
    }
    ok(res, {
      ...agreementView(loan, { includeSigningUrl: true }),
      terms: {
        amountApproved: loan.decision?.amountApproved ?? null,
        rateAPR: loan.decision?.rateAPR ?? null,
        tenureMonths: loan.decision?.tenureMonths ?? null,
        emi: loan.decision?.emi ?? null,
        totalRepaymentAmount: loan.decision?.totalRepaymentAmount ?? null,
        netDisbursalAmount: loan.decision?.netDisbursalAmount ?? null,
        allInclusiveApr: loan.decision?.allInclusiveApr ?? null,
      },
    });
  } catch (e) { next(e); }
});

router.post('/:id/agreement/sign', requireAuth, async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    if (req.body?.accepted !== true) return fail(res, 'CONSENT_REQUIRED', 'Review and accept the loan agreement before continuing.', 400);
    const borrower = await User.findById(req.user.uid).select('name email mobile').lean();
    const result = await startAgreementSigning(loan, borrower);
    ok(res, result, result.status === 'SIGNED' ? 'Your agreement is already signed.' : 'Your secure signing page is ready.');
  } catch (e) {
    if (!agreementFailure(res, e)) next(e);
  }
});

router.post('/:id/agreement/status', requireAuth, async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    const result = await syncAgreementSignature(loan, { retry: false, actorType: 'USER', actorId: req.user.uid });
    ok(res, result, result.status === 'SIGNED' ? 'Agreement signed and verified successfully.' : 'Your signature is still pending.');
  } catch (e) {
    if (!agreementFailure(res, e)) next(e);
  }
});

// get one
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    ok(res, loan);
  } catch (e) { next(e); }
});

export default router;
