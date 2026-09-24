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
import { SignCareError, createESign, getESignStatus, getESignAudit, signcareRequestId, verifyBankAccount, verifyUpiName } from '../services/signcare.js';
import { generateLoanAgreementPdf } from '../services/loanAgreement.js';
import { normalizeSigncarePennyDrop } from '../utils/signcareBankVerification.js';
import { normalizeSigncareUpiName } from '../utils/signcareUpiVerification.js';
import { buildUnderwritingSummary } from '../utils/underwritingRisk.js';

// Memory storage for Cloudinary uploads
const memoryStorage = multer.memoryStorage();
const uploadManyMemory = (field='files', max=10) => multer({ storage: memoryStorage, limits:{ fileSize: 10*1024*1024 } }).array(field, max);

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
  if (sameBank && ['VERIFIED', 'REVIEW'].includes(String(verification.bank?.status || '').toUpperCase())) {
    bankValidation = {
      ...(verification.bank.data || {}),
      status: verification.bank.status,
      isValid: verification.bank.status === 'VERIFIED',
      message: verification.bank.message || verification.bank.data?.message || 'Bank details already verified.',
    };
  } else {
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
          await verification.save();
          throw Object.assign(new Error(bankValidation.message), {
            status: 400,
            code: 'BANK_VERIFICATION_FAILED',
            data: bankValidation,
          });
        }
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

// Create loan application (wizard or simple)
router.post('/', requireAuth, uploadManyMemory('files', 10), async (req, res, next) => {
  try {
    const eligibility = await getLoanEligibility(req.user.uid);
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
        name: Joi.string().required(),
        email: Joi.string().email().allow('').default(''),
        mobile: Joi.string().allow('').default(''),
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
        monthlyIncome: Joi.number().default(0),
        employerOrBusiness: Joi.string().allow(''),
        experienceYears: Joi.number().default(0),
      }).optional(),
      documents: Joi.object({
        aadhaarFrontUrl: Joi.string().allow(null,''),
        aadhaarBackUrl: Joi.string().allow(null,''),
        panUrl: Joi.string().allow(null,''),
        selfieUrl: Joi.string().allow(null,''),
        incomeProofUrl: Joi.string().allow(null,''),
        incomeProofType: Joi.string().valid('SALARY_SLIP', 'BANK_STATEMENT', 'OTHER').allow(null,''),
        aadhaarEkyc: Joi.object().unknown(true).optional(),
        panVerification: Joi.object().unknown(true).optional(),
      }).optional(),
      references: Joi.array().items(Joi.object({
        name: Joi.string().allow(''),
        relation: Joi.string().allow(''),
        mobile: Joi.string().allow('')
      })).default([]),
      bankDetails: Joi.object({
        bankName: Joi.string().allow('').default(''),
        accountNumber: Joi.string().pattern(ACCOUNT_PATTERN).required().messages({
          'string.pattern.base': 'Enter a valid bank account number (6-20 digits).',
          'any.required': 'Bank account number is required.',
        }),
        ifscCode: Joi.string().uppercase().pattern(IFSC_PATTERN).required().messages({
          'string.pattern.base': 'Enter a valid 11-character IFSC code.',
          'any.required': 'IFSC code is required.',
        }),
        accountHolderName: Joi.string().allow('').default(''),
        upiId: Joi.string().pattern(UPI_PATTERN).allow('').default('').messages({
          'string.pattern.base': 'Enter a valid UPI ID, for example name@bank.',
        }),
        upiAccountName: Joi.string().allow('').default(''),
        bankValidation: Joi.object().unknown(true).optional(),
        upiValidation: Joi.object().unknown(true).optional(),
      }).required(),
      amountRequested: Joi.number().min(1000).max(500000).required().messages({
        'number.min': 'Minimum loan amount is Rs. 1,000.',
        'number.max': 'Maximum loan amount is Rs. 5,00,000.',
        'any.required': 'Loan amount is required.',
      }),
      tenureMonths: Joi.number().integer().min(3).max(60).required().messages({
        'number.min': 'Minimum tenure is 3 months.',
        'number.max': 'Maximum tenure is 60 months.',
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
    // instead of one field per round trip.
    const payload = await schema.validateAsync(requestBody, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (!payload.personal?.mobile || !MOBILE_PATTERN.test(String(payload.personal.mobile).trim())) {
      // Relax mobile check — use the authenticated user's registered mobile if not provided.
      if (payload.personal) payload.personal.mobile = payload.personal.mobile || '';
    }

    // Monthly income is captured but not enforced at submit time.
    // const monthlyIncome = Number(payload.employment?.monthlyIncome || 0);
    // if (!(monthlyIncome > 0)) { ... }
    const user = await User.findById(req.user.uid).select('kyc mobile');
    // KYC hard-blocks are bypassed temporarily — admin reviews before approval.
    const validation = await verifyLoanBankAndUpi({
      userId: req.user.uid,
      mobile: payload.personal?.mobile || user?.mobile,
      bankDetails: payload.bankDetails,
    });
    await hydrateIdentityVerificationFromUserKyc(validation.verification, user);
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
    const signcareVerification = validation.verification.toObject();
    // Verification stage checks are skipped at submit time — admin reviews
    const requiredSigncareStages = ['pan', 'aadhaar', 'liveness', 'faceMatch', 'bank', 'credit'];
    const incompleteStages = requiredSigncareStages.filter(
      (stage) => !['VERIFIED', 'REVIEW'].includes(String(signcareVerification?.[stage]?.status || '').toUpperCase())
    );
    if (payload.documents?.incomeProofType === 'BANK_STATEMENT' &&
        signcareVerification?.bankStatement?.status !== 'VERIFIED') {
      payload.documents.incomeProofType = 'OTHER';
    }

    // Handle document uploads to Cloudinary if files are provided
    let documents = payload.documents || {};
    const aadhaarData = normalizeAadhaarKycData(
      user.kyc?.aadhaarVerification?.response || user.kyc?.aadhaarData?.raw || user.kyc?.aadhaarData,
      user.kyc?.aadhaarData
    );
    documents.aadhaarEkyc = {
      verified: true,
      aadhaarNumber: user.kyc?.aadhaarNumber,
      aadhaarMobile: user.kyc?.aadhaarMobile,
      verifiedAt: user.kyc?.aadhaarVerification?.verifiedAt,
      orderId: user.kyc?.aadhaarVerification?.orderId,
      aadhaarData
    };
    documents.panVerification = {
      verified: true,
      panNumber: user.kyc?.panNumber,
      panName: user.kyc?.panName,
      verifiedAt: user.kyc?.panVerification?.verifiedAt,
      orderId: user.kyc?.panVerification?.orderId,
      panData: user.kyc?.panData,
      response: user.kyc?.panVerification?.response
    };
    if (req.files && req.files.length > 0) {
      const uploadResults = await Promise.allSettled(
        req.files.map((file) => uploadToCloudinary(file.buffer, 'loan-documents'))
      );
      const uploadFailures = [];
      uploadResults.forEach((settled, index) => {
        if (settled.status === 'rejected') {
          uploadFailures.push({
            filename: req.files[index]?.originalname || `file-${index + 1}`,
            message: settled.reason?.message || 'Document upload failed',
          });
          return;
        }
        const result = settled.value;
        const field = documentFieldFor(req.files[index]?.originalname);
        // Unrecognised filenames are skipped rather than defaulting into the
        // Aadhaar-front slot, which previously let an unnamed upload silently
        // replace a real Aadhaar scan.
        if (field && result?.secure_url) documents[field] = result.secure_url;
      });
      if (uploadFailures.length > 0) {
        console.warn('Loan document upload partially failed', uploadFailures);
        documents.uploadReview = {
          status: 'REVIEW',
          message: 'Some uploaded documents could not be stored automatically. Khatu Pay will review this application.',
          failures: uploadFailures,
          capturedAt: new Date(),
        };
      }
    }

    // Selfie and income proof are skipped at submit time — admin reviews before approval.
    // if (!documents.selfieUrl) { ... }
    // if (!documents.incomeProofUrl) { ... }

    documents.incomeProofType = payload.documents?.incomeProofType || 'OTHER';

    const references = Array.isArray(payload.references)
      ? payload.references.filter((ref) => ref?.name || ref?.relation || ref?.mobile)
      : [];

    // Generate 8-digit loan account number
    const generateLoanAccountNumber = () => {
      const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
      const random = Math.floor(Math.random() * 100); // 2-digit random number
      return (timestamp + random.toString().padStart(2, '0')).slice(-8); // Ensure exactly 8 digits
    };

    const loanAccountNumber = generateLoanAccountNumber();

    const verificationSnapshot = signcareVerification ? Object.fromEntries(
      ['pan', 'aadhaar', 'liveness', 'faceMatch', 'bank', 'upi', 'bankStatement', 'credit', 'accountAggregator', 'agreement', 'eStamp', 'eSign', 'auditTrail']
        .map((key) => [key, {
          status: signcareVerification[key]?.status || 'NOT_STARTED',
          requestId: signcareVerification[key]?.requestId || '',
          providerReference: signcareVerification[key]?.providerReference || '',
          message: signcareVerification[key]?.message || '',
          requiresReview: incompleteStages.includes(key),
          verifiedAt: signcareVerification[key]?.verifiedAt || null,
        }])
    ) : {};
    const underwriting = buildUnderwritingSummary({
      loan: { application: { ...payload, documents, references, bankDetails: payload.bankDetails } },
      verification: signcareVerification,
    });

    const loan = await Loan.create({
      userId: req.user.uid,
      loanAccountNumber: loanAccountNumber,
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
      consents: {
        creditReport: {
          accepted: true, acceptedAt: new Date(), version: payload.consents.version,
          ipAddress: req.ip, userAgent: req.get('user-agent') || ''
        },
        terms: {
          accepted: true, acceptedAt: new Date(), version: payload.consents.version,
          ipAddress: req.ip, userAgent: req.get('user-agent') || ''
        },
        privacy: {
          accepted: true, acceptedAt: new Date(), version: payload.consents.version,
          ipAddress: req.ip, userAgent: req.get('user-agent') || ''
        }
      },
      verification: {
        provider: 'SIGNCARE',
        verificationId: signcareVerification?._id,
        snapshot: { ...verificationSnapshot, incompleteStages, underwriting },
        capturedAt: new Date(),
      },
      statusHistory: [{
        status: 'PENDING',
        title: 'Application submitted',
        message: 'Your application was received and is awaiting review.',
        actorType: 'USER',
        actorId: req.user.uid
      }]
    });

    // Notifications are best-effort. The loan is already persisted at this
    // point, so a push/notification outage must not turn a successful
    // application into an error the user is asked to retry - which would
    // create a duplicate loan.
    try {
      await Notification.create({
        userId: req.user.uid,
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

      await notifyUserSmart(req.user.uid, 'loan_application_submitted', {
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

    ok(
      res,
      {
        loanId: loan._id,
        _id: loan._id,
        id: loan._id,
        loanAccountNumber,
        status: loan.status,
        amountRequested: payload.amountRequested,
        tenureMonths: payload.tenureMonths,
      },
      'Loan application submitted. Our team will review it shortly.',
      { code: 'LOAN_APPLICATION_SUBMITTED', status: 201 }
    );
  } catch (e) { next(e); }
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

function signcareData(result) {
  const body = result?.response || {};
  return body?.data || body?.result || body;
}

function safeProviderData(data = {}) {
  const {
    content, documentContent, signedDocument, esignLink, signingUrl,
    ...safe
  } = data || {};
  return safe;
}

router.get('/:id/agreement', requireAuth, async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user.uid }).lean();
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    const verification = await LoanVerification.findOne({ userId: req.user.uid }).lean();
    ok(res, {
      status: loan.decision?.agreementStatus || 'NOT_AVAILABLE',
      agreementUrl: loan.decision?.agreementUrl || '',
      signedAgreementUrl: loan.decision?.signedAgreementUrl || '',
      documentId: loan.decision?.agreementDocumentId || '',
      signedAt: loan.decision?.agreementSignedAt || null,
      eSignStatus: verification?.eSign?.status || 'NOT_STARTED',
      auditStatus: verification?.auditTrail?.status || 'NOT_STARTED',
    });
  } catch (e) { next(e); }
});

router.post('/:id/agreement/sign', requireAuth, async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    if (loan.status !== 'APPROVED') return fail(res, 'INVALID_STATE', 'The agreement becomes available after loan approval.', 409);
    if (loan.decision?.agreementStatus === 'SIGNED') {
      return ok(res, { status: 'SIGNED', signedAgreementUrl: loan.decision.signedAgreementUrl });
    }
    if (!req.body?.accepted) return fail(res, 'CONSENT_REQUIRED', 'Review and accept the loan agreement before continuing.', 400);

    const [borrower, verification] = await Promise.all([
      User.findById(req.user.uid).select('name email mobile').lean(),
      LoanVerification.findOne({ userId: req.user.uid }),
    ]);
    if (!borrower || !verification) return fail(res, 'VERIFICATION_NOT_FOUND', 'Your verified borrower profile is unavailable.', 409);

    const pdf = await generateLoanAgreementPdf(loan, borrower);
    const requestId = signcareRequestId('KP-ESIGN');
    const result = await createESign({
      referenceId: `KP-LOAN-${loan._id}`,
      documentInfo: { name: `KhatuPay Loan Agreement ${loan.loanAccountNumber || loan._id}.pdf`, content: pdf.toString('base64') },
      sequentialSigning: false,
      userInfo: [{
        name: borrower.name || loan.application?.personal?.name,
        emailId: borrower.email || loan.application?.personal?.email,
        mobileNo: borrower.mobile || loan.application?.personal?.mobile,
        userType: 'Signer', signatureType: 'Aadhaar', userReferenceId: `KPUSER-${borrower._id}`,
        aadhaarOptions: { otp: true, biometricThumbScan: false, irisScan: false, face: false },
        pageToBeSigned: 2, signAppearance: 4,
      }],
      senderName: 'KhatuPay', descriptionForInvitee: 'Review and sign your KhatuPay loan agreement.',
      skipVerificationCode: false,
    }, requestId);
    const data = signcareData(result);
    const signer = Array.isArray(data.userInfo) ? data.userInfo[0] : data.signerInfo?.[0];
    const documentId = String(data.documentId || '').trim();
    const signingUrl = String(signer?.esignLink || data.esignLink || '').trim();
    if (!documentId || !signingUrl) return fail(res, 'ESIGN_START_FAILED', 'The signing page could not be created. Please try again.', 502);

    verification.eSign = {
      status: 'PENDING', requestId: result.requestId || requestId, providerReference: documentId,
      message: 'Agreement is awaiting Aadhaar eSign.', updatedAt: new Date(), data: safeProviderData(data),
    };
    loan.decision.agreementStatus = 'PENDING_SIGNATURE';
    loan.decision.agreementDocumentId = documentId;
    await Promise.all([verification.save(), loan.save()]);
    ok(res, { status: 'PENDING_SIGNATURE', documentId, signingUrl }, 'Your secure signing page is ready.');
  } catch (e) { next(e); }
});

router.post('/:id/agreement/status', requireAuth, async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    if (loan.decision?.agreementStatus === 'SIGNED' && loan.decision?.signedAgreementUrl) {
      return ok(res, {
        status: 'SIGNED', signedAgreementUrl: loan.decision.signedAgreementUrl,
        signedAt: loan.decision.agreementSignedAt,
      });
    }
    const verification = await LoanVerification.findOne({ userId: req.user.uid });
    const documentId = loan.decision?.agreementDocumentId || verification?.eSign?.providerReference;
    if (!documentId || !verification) return fail(res, 'ESIGN_NOT_STARTED', 'Start agreement signing before checking its status.', 409);

    const requestId = signcareRequestId('KP-ESIGN-STATUS');
    const result = await getESignStatus({ documentId, ...(verification.eSign?.data?.documentReferenceId ? { documentReferenceId: verification.eSign.data.documentReferenceId } : {}) }, requestId);
    const data = signcareData(result);
    const providerStatus = String(data.documentStatus || data.status || '').toUpperCase();
    const completed = ['COMPLETED', 'SIGNED', 'SUCCESS'].includes(providerStatus);
    if (!completed) {
      verification.eSign.status = providerStatus === 'FAILED' ? 'FAILED' : 'PENDING';
      verification.eSign.message = providerStatus === 'FAILED' ? 'Agreement signing was not completed.' : 'Agreement signing is still pending.';
      verification.eSign.updatedAt = new Date();
      verification.eSign.data = safeProviderData(data);
      await verification.save();
      return ok(res, { status: verification.eSign.status, providerStatus });
    }

    const content = data.content || data.documentContent || data.signedDocument;
    if (!content) return fail(res, 'SIGNED_DOCUMENT_PENDING', 'Signature is complete, but the signed copy is still being prepared. Please refresh shortly.', 409);
    const base64 = String(content).replace(/^data:[^;]+;base64,/i, '').replace(/\s/g, '');
    const uploaded = await uploadToCloudinary(Buffer.from(base64, 'base64'), 'khatupay/signed-loan-agreements');
    loan.decision.agreementStatus = 'SIGNED';
    loan.decision.agreementDocumentId = documentId;
    loan.decision.agreementSignedAt = new Date();
    loan.decision.signedAgreementUrl = uploaded.secure_url;
    verification.eSign = {
      status: 'VERIFIED', requestId: result.requestId || requestId, providerReference: documentId,
      message: 'Loan agreement signed successfully.', verifiedAt: new Date(), updatedAt: new Date(), data: safeProviderData(data),
    };
    try {
      const auditResult = await getESignAudit(documentId, signcareRequestId('KP-ESIGN-AUDIT'));
      verification.auditTrail = {
        status: 'VERIFIED', requestId: auditResult.requestId, providerReference: documentId,
        message: 'Digital signing audit trail verified.', verifiedAt: new Date(), updatedAt: new Date(),
        data: safeProviderData(signcareData(auditResult)),
      };
    } catch (_) {
      verification.auditTrail = { status: 'PENDING', providerReference: documentId, message: 'Signed successfully. Audit trail sync is pending.', updatedAt: new Date() };
    }
    loan.statusHistory.push({ status: 'APPROVED', title: 'Agreement signed', message: 'The digital loan agreement was signed successfully.', actorType: 'USER', actorId: req.user.uid });
    await Promise.all([loan.save(), verification.save()]);
    ok(res, { status: 'SIGNED', signedAgreementUrl: uploaded.secure_url, signedAt: loan.decision.agreementSignedAt });
  } catch (e) { next(e); }
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
