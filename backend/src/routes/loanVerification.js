import { Router } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import multer from 'multer';
import LoanVerification from '../models/LoanVerification.js';
import Loan from '../models/Loan.js';
import User from '../models/User.js';
import CreditReport from '../models/CreditReport.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';
import signcareConfig from '../config/signcare.js';
import {
  SignCareError, createESign, createEStamp, fetchExperianReport, getAadhaarOvseResult,
  getDigiLockerDetails, initDigiLocker,
  getBankStatementAnalysis,
  getESignAudit, getESignStatus, initAadhaarOvse, publicSigncareConfig, signcareRequestId,
  submitBankStatement, verifyBankAccount, verifyFaceMatch, verifyLiveness, verifyPan, verifyUpiName,
} from '../services/signcare.js';
import { sendPanVerify } from '../services/clubapiClient.js';
import { isPanVerified, normalizePanKycData } from '../utils/panKyc.js';
import { normalizeAadhaarKycData } from '../utils/aadhaarKyc.js';
import { extractAadhaarFaceImage, faceMatchPassed, faceStageSummary, livenessPassed } from '../utils/faceVerification.js';
import { normalizeSigncarePennyDrop } from '../utils/signcareBankVerification.js';
import { normalizeSigncareUpiName } from '../utils/signcareUpiVerification.js';
import {
  CREDIT_PENDING_STALE_MS, EXPERIAN_PROVIDER, buildExperianRetailRequest, decodeExperianExcel, detachExcelReport,
  experianRetailVerified, experianStageMessage, normalizeSigncareExperianRetail, reusableCreditStage,
} from '../utils/signcareCreditReport.js';
import AuditLog from '../models/AuditLog.js';

const router = Router();
const CONSENT_TEXT = 'I consent to Khatu Pay verifying my identity, bank account and credit information through SignCare for loan eligibility assessment.';
const STAGES = ['pan', 'aadhaar', 'liveness', 'faceMatch', 'bank', 'upi', 'bankStatement', 'credit', 'accountAggregator', 'agreement', 'eStamp', 'eSign', 'auditTrail'];
const statementUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(
    file.mimetype === 'application/pdf' ? null : new Error('Only PDF bank statements are supported.'),
    file.mimetype === 'application/pdf'
  ),
}).single('statement');
const acceptStatement = (req, res, next) => statementUpload(req, res, (error) => {
  if (!error) return next();
  const tooLarge = error.code === 'LIMIT_FILE_SIZE';
  return fail(
    res,
    tooLarge ? 'STATEMENT_TOO_LARGE' : 'INVALID_STATEMENT',
    tooLarge ? 'Bank statement PDF must be 12 MB or smaller.' : error.message,
    400
  );
});

const getRecord = (userId) => LoanVerification.findOneAndUpdate(
  { userId }, { $setOnInsert: { userId, provider: 'SIGNCARE' } }, { new: true, upsert: true, setDefaultsOnInsert: true }
);

function publicStage(stage = {}) {
  const data = stage.data || {};
  const experian = data.jsonExperianReport || data.experianReport || {};
  const pan = normalizePanKycData(data);
  const face = faceStageSummary(data);
  return {
    status: stage.status || 'NOT_STARTED', requestId: stage.requestId || '',
    providerReference: stage.providerReference || '', message: stage.message || '',
    verifiedAt: stage.verifiedAt || null, updatedAt: stage.updatedAt || null,
    summary: {
      name: pan.name || data.name || data.fullName || data.residentName || data.accountHolderName || data.accountName || data.beneficiaryName || data.beneficiary_name || '',
      panNumber: pan.panNumber || data.panNumber || data.pan || '',
      firstName: pan.firstName || '',
      middleName: pan.middleName || '',
      lastName: pan.lastName || '',
      dob: pan.dob || data.dob || data.dateOfBirth || '',
      category: pan.category || data.category || '',
      panStatus: pan.panStatus || pan.status || data.status || data.pan_status || '',
      aadhaarSeedingStatus: pan.aadhaarSeedingStatus || data.aadhaarSeedingStatus || data.aadhaar_seeding_status || '',
      nameMatchResult: pan.nameMatchResult ?? data.name_as_per_pan_match ?? null,
      dobMatchResult: pan.dobMatchResult ?? data.date_of_birth_match ?? null,
      // The normalized bureau summary already range-checks the score, so it wins over the raw fields.
      score: data.summary?.provider === EXPERIAN_PROVIDER ? data.summary.score ?? null : (
        data.score?.fcirexScore ?? data.score ?? data.creditScore ??
        experian.score?.fcirexScore ?? data.summary?.score ?? data.livenessScore ?? data.matchScore ?? null),
      reportNumber: experian.creditProfileHeader?.reportNumber || data.summary?.reportNumber || '',
      bureau: data.bureau || data.summary?.bureau || '',
      scoreBand: data.summary?.scoreBand || '',
      accountCount: data.summary?.accountCount ?? null,
      activeAccounts: data.summary?.activeAccounts ?? null,
      hasExcelReport: data.summary?.hasExcelReport === true,
      livenessScore: face.livenessScore,
      matchScore: face.matchScore,
      providerStatus: face.providerStatus,
      providerMessage: face.message,
      bankName: data.bankName || data.bank_name || '', documentStatus: data.documentStatus || '',
    },
  };
}

function present(record, admin = false) {
  const result = {
    id: record?._id, provider: 'SIGNCARE', configured: publicSigncareConfig(),
    consent: { accepted: record?.consent?.accepted === true, acceptedAt: record?.consent?.acceptedAt || null, version: record?.consent?.version || '' },
    stages: Object.fromEntries(STAGES.map((key) => [key, publicStage(record?.[key])])),
  };
  if (admin) result.evidence = Object.fromEntries(STAGES.map((key) => [key, record?.[key]?.data || null]));
  return result;
}

const stageData = (response) => response?.data && typeof response.data === 'object' ? response.data : response || {};
// transection_Id is SignCare's own typo in their DigiLocker response — kept intentionally.
const referenceOf = (data = {}) => String(data.txnId || data.transactionId || data.transection_Id || data.documentId || data.referenceId || data.orderId || '');
const verifiedFlag = (data = {}, keys = []) => keys.some((key) => data?.[key] === true) ||
  ['SUCCESS', 'VERIFIED', 'COMPLETED'].includes(String(data.status || data.verificationStatus || '').toUpperCase());

function maskPan(pan = '') {
  const text = String(pan || '').toUpperCase();
  return text.length >= 4 ? `XXXXXX${text.slice(-4)}` : text;
}

async function hydrateIdentityFromUserKyc(record, user) {
  let changed = false;
  if (record.pan?.status !== 'VERIFIED' && user?.kyc?.panVerified === true) {
    record.pan = {
      status: 'VERIFIED',
      requestId: record.pan?.requestId || signcareRequestId('KP-SAVED-PAN'),
      message: 'PAN verified from saved KYC.',
      verifiedAt: user.kyc.panVerification?.verifiedAt || record.pan?.verifiedAt || new Date(),
      updatedAt: new Date(),
      data: user.kyc.panData || user.kyc.panVerification?.response || {},
    };
    changed = true;
  }
  if (record.aadhaar?.status !== 'VERIFIED' && user?.kyc?.aadhaarVerified === true) {
    record.aadhaar = {
      status: 'VERIFIED',
      requestId: record.aadhaar?.requestId || signcareRequestId('KP-SAVED-AADHAAR'),
      providerReference: record.aadhaar?.providerReference || user.kyc.aadhaarVerification?.transactionId || user.kyc.aadhaarVerification?.txnId || '',
      message: 'Identity verified from saved KYC.',
      verifiedAt: user.kyc.aadhaarVerification?.verifiedAt || record.aadhaar?.verifiedAt || new Date(),
      updatedAt: new Date(),
      data: user.kyc.aadhaarData || user.kyc.aadhaarVerification?.response || {},
    };
    changed = true;
  }
  if (changed) await record.save();
  return record;
}

function digilockerAadhaarData(data = {}) {
  const documents = Array.isArray(data.docs) ? data.docs : [];
  const document = documents.find((item) =>
    String(item?.docType || item?.doctype || item?.issued?.doctype || '').toUpperCase() === 'ADHAR'
  ) || documents[0] || {};
  const details = document?.details && typeof document.details === 'object'
    ? document.details
    : document;
  return normalizeAadhaarKycData({ ...details, raw: data });
}

function digilockerComplete(data = {}) {
  if (data.pending === true) return false;
  const documents = Array.isArray(data.docs) ? data.docs : [];
  return documents.some((item) =>
    ['FETCHED', 'COMPLETED', 'VERIFIED'].includes(String(item?.status || item?.documentStatus || '').toUpperCase())
  ) || verifiedFlag(data, ['verificationPassed']);
}

// request_url is SignCare's snake_case field name in the DigiLocker init response.
function digilockerUrl(data = {}) {
  return String(data.request_url || data.requestUrl || data.redirectUrl || data.authUrl || data.url || data.link || '').trim();
}

async function requireConsent(userId) {
  const record = await getRecord(userId);
  if (!record.consent?.accepted) throw Object.assign(new Error('Accept verification consent before continuing.'), { status: 400, code: 'CONSENT_REQUIRED' });
  return record;
}

async function saveStage(record, key, call, successCheck = () => true) {
  const requestId = signcareRequestId(`KP-${key}`);
  record[key] = { status: 'PENDING', requestId, updatedAt: new Date(), message: 'Verification in progress.' };
  await record.save();
  try {
    const result = await call(requestId);
    const data = stageData(result.response);
    const verified = successCheck(data, result.response);
    record[key] = {
      status: verified ? 'VERIFIED' : 'REVIEW', requestId: result.requestId,
      providerReference: referenceOf(data), message: verified ? 'Verified successfully.' : 'Verification requires review.',
      ...(verified ? { verifiedAt: new Date() } : {}), updatedAt: new Date(), data,
    };
    await record.save();
    return record[key];
  } catch (error) {
    record[key] = { status: 'FAILED', requestId, message: error.message, updatedAt: new Date(), data: error.data || null };
    await record.save();
    throw error;
  }
}

router.get('/config', requireAuth, (_req, res) => ok(res, publicSigncareConfig()));
router.get('/me', requireAuth, async (req, res, next) => {
  try { ok(res, present(await getRecord(req.user.uid))); } catch (error) { next(error); }
});

router.post('/consent', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object({ accepted: Joi.boolean().valid(true).required(), version: Joi.string().max(30).default('2026-09') }).validateAsync(req.body);
    const record = await getRecord(req.user.uid);
    record.consent = { accepted: true, text: CONSENT_TEXT, version: payload.version, acceptedAt: new Date(), ipAddress: req.ip, userAgent: req.get('user-agent') || '' };
    await record.save();
    ok(res, present(record), 'Verification consent recorded.');
  } catch (error) { next(error); }
});

router.post('/pan', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object({
      pan: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/i).required(),
      name: Joi.string().min(2).max(120).allow('', null).default('Customer'),
      dob: Joi.string().allow('').default(''),
    }).validateAsync(req.body);
    const record = await requireConsent(req.user.uid);
    const panNumber = payload.pan.toUpperCase();

    // Step 1: ClubAPI — fetch the real name registered on this PAN.
    // transType=panVerify returns { firstName, middleName, lastName, status }
    let clubapiName = '';
    try {
      const clubResult = await sendPanVerify({ pan: panNumber });
      if (clubResult.delivery === 'received') {
        const cd = clubResult.data?.panData || clubResult.data || {};
        const parts = [cd.firstName, cd.middleName, cd.lastName]
          .map((p) => String(p || '').trim())
          .filter(Boolean);
        if (parts.length) clubapiName = parts.join(' ');
      }
    } catch (_) {
      // ClubAPI failure is non-fatal — SignCare status check still runs.
    }

    // Step 2: SignCare — validate PAN exists (VALID/INVALID status check).
    await saveStage(
      record, 'pan',
      (requestId) => verifyPan({
        pan: panNumber,
        name: clubapiName || payload.name || 'Customer',
        dob: payload.dob,
        consentText: CONSENT_TEXT,
        requestId,
      }),
      (data) => isPanVerified(data) || verifiedFlag(data, ['panValid', 'nameMatched']),
    );

    // Merge ClubAPI name into the normalized data so it is saved and returned.
    const data = normalizePanKycData(record.pan.data || {}, {
      panNumber,
      ...(clubapiName ? { name: clubapiName } : {}),
    });
    record.pan.data = data;
    await record.save();

    await User.findByIdAndUpdate(req.user.uid, { $set: {
      'kyc.panNumber': panNumber,
      'kyc.panVerified': record.pan.status === 'VERIFIED',
      'kyc.panName': clubapiName || '',
      'kyc.panData': data,
      'kyc.panVerification': {
        provider: 'SIGNCARE+CLUBAPI', requestId: record.pan.requestId,
        verifiedAt: record.pan.verifiedAt, response: data,
      },
    } });
    ok(res, publicStage(record.pan), record.pan.message);
  } catch (error) { next(error); }
});

router.post('/aadhaar/init', requireAuth, async (req, res, next) => {
  try {
    const { channel } = await Joi.object({ channel: Joi.string().valid('web', 'qr').default('web') }).validateAsync(req.body);
    const record = await requireConsent(req.user.uid);
    const stage = await saveStage(record, 'aadhaar', (requestId) => initAadhaarOvse({ channel, requestId }), () => false);
    const data = record.aadhaar.data || {};
    ok(res, { ...publicStage(stage), txnId: data.txnId, requestUrl: data.requestUrl, intentJwt: data.intentJwt, qrPayload: data.qrPayload, expiresAt: data.expiresAt }, 'Continue Aadhaar verification.');
  } catch (error) { next(error); }
});

// DigiLocker is the loan identity path. Unlike Aadhaar OVSE, it does not
// launch the Aadhaar Pehchaan app or ask the customer to install it.
router.post('/digilocker/init', requireAuth, async (req, res, next) => {
  try {
    const record = await requireConsent(req.user.uid);
    const user = await User.findById(req.user.uid).select('mobile').lean();
    const mobileNumber = String(user?.mobile || '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(mobileNumber)) {
      return fail(res, 'MOBILE_REQUIRED', 'Add a valid mobile number to your profile before identity verification.', 400);
    }

    const requestId = signcareRequestId('KP-DIGILOCKER');
    record.aadhaar = {
      status: 'PENDING', requestId, message: 'Waiting for secure DigiLocker consent.', updatedAt: new Date(),
    };
    await record.save();
    try {
      const result = await initDigiLocker({ mobileNumber, consentText: CONSENT_TEXT, requestId });
      const data = stageData(result.response);
      const transactionId = referenceOf(data);
      const requestUrl = digilockerUrl(data);
      if (!transactionId || !requestUrl) {
        throw new SignCareError('SignCare did not return a secure DigiLocker session.', 502, data);
      }
      record.aadhaar = {
        status: 'PENDING', requestId: result.requestId, providerReference: transactionId,
        message: 'Complete secure DigiLocker consent.', updatedAt: new Date(), data,
      };
      await record.save();
      return ok(res, {
        ...publicStage(record.aadhaar), transactionId, requestUrl,
      }, 'Continue secure DigiLocker verification.');
    } catch (error) {
      record.aadhaar = {
        status: 'FAILED', requestId, message: error.message, updatedAt: new Date(), data: error.data || null,
      };
      await record.save();
      throw error;
    }
  } catch (error) { next(error); }
});

router.get('/digilocker/result/:transactionId', requireAuth, async (req, res, next) => {
  try {
    const record = await requireConsent(req.user.uid);
    if (record.aadhaar?.providerReference !== req.params.transactionId) {
      return fail(res, 'INVALID_TRANSACTION', 'This identity verification request does not belong to your account.', 403);
    }
    const result = await getDigiLockerDetails(
      req.params.transactionId,
      record.aadhaar.requestId || signcareRequestId('KP-DIGILOCKER-STATUS'),
    );
    const data = stageData(result.response);
    const verified = digilockerComplete(data);
    const claims = digilockerAadhaarData(data);
    record.aadhaar = {
      status: verified ? 'VERIFIED' : 'PENDING', requestId: result.requestId,
      providerReference: req.params.transactionId,
      message: verified ? 'Identity verified through DigiLocker.' : 'Waiting for DigiLocker verification.',
      ...(verified ? { verifiedAt: new Date() } : {}), updatedAt: new Date(), data: claims,
    };
    await record.save();
    if (verified) await User.findByIdAndUpdate(req.user.uid, { $set: {
      'kyc.aadhaarVerified': true,
      'kyc.aadhaarData': claims,
      'kyc.aadhaarVerification': {
        provider: 'SIGNCARE_DIGILOCKER', transactionId: req.params.transactionId,
        verifiedAt: new Date(), response: claims,
      },
    } });
    return ok(res, publicStage(record.aadhaar), record.aadhaar.message);
  } catch (error) { next(error); }
});

router.get('/aadhaar/result/:txnId', requireAuth, async (req, res, next) => {
  try {
    const record = await requireConsent(req.user.uid);
    if (record.aadhaar?.providerReference && record.aadhaar.providerReference !== req.params.txnId) return fail(res, 'INVALID_TRANSACTION', 'This Aadhaar request does not belong to your account.', 403);
    const result = await getAadhaarOvseResult(req.params.txnId, record.aadhaar.requestId || signcareRequestId('KP-AADHAAR'));
    const data = stageData(result.response);
    const claims = data.verifiedClaims || data.claims || data;
    const verified = data.verificationPassed === true || data.verified === true || verifiedFlag(data, ['verificationPassed']);
    record.aadhaar = { status: verified ? 'VERIFIED' : 'PENDING', requestId: result.requestId, providerReference: req.params.txnId,
      message: verified ? 'Aadhaar identity verified.' : 'Waiting for Aadhaar verification.', ...(verified ? { verifiedAt: new Date() } : {}), updatedAt: new Date(), data: claims };
    await record.save();
    if (verified) await User.findByIdAndUpdate(req.user.uid, { $set: {
      'kyc.aadhaarVerified': true, 'kyc.aadhaarData': claims,
      'kyc.aadhaarVerification': { provider: 'SIGNCARE_OVSE', txnId: req.params.txnId, verifiedAt: new Date(), response: claims },
    } });
    ok(res, publicStage(record.aadhaar), record.aadhaar.message);
  } catch (error) { next(error); }
});

router.post('/liveness', requireAuth, async (req, res, next) => {
  try {
    const { imageBase64 } = await Joi.object({ imageBase64: Joi.string().min(100).required() }).validateAsync(req.body);
    const record = await requireConsent(req.user.uid);
    try {
      await saveStage(record, 'liveness', (requestId) => verifyLiveness({ image: imageBase64, requestId }),
        (data) => livenessPassed(data));
    } catch (error) {
      if (!(error instanceof SignCareError)) throw error;
      record.liveness = {
        status: 'REVIEW',
        requestId: record.liveness?.requestId || signcareRequestId('KP-liveness'),
        message: 'Live photo captured. Khatu Pay will review it.',
        updatedAt: new Date(),
        data: { providerError: error.data || null },
      };
      await record.save();
    }
    ok(res, publicStage(record.liveness), record.liveness.message);
  } catch (error) { next(error); }
});

router.post('/face-match', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object({ selfieBase64: Joi.string().min(100).required(), identityPhotoBase64: Joi.string().min(100).optional() }).validateAsync(req.body);
    const record = await requireConsent(req.user.uid);
    const identityPhoto = payload.identityPhotoBase64 || extractAadhaarFaceImage(record.aadhaar?.data);
    if (!identityPhoto) {
      const requestId = signcareRequestId('KP-faceMatch');
      record.faceMatch = {
        status: 'REVIEW',
        requestId,
        message: 'Live selfie captured. Aadhaar photo was not available, so Khatu Pay will review the face match.',
        updatedAt: new Date(),
        data: { reason: 'IDENTITY_PHOTO_NOT_AVAILABLE' },
      };
      await record.save();
      return ok(res, publicStage(record.faceMatch), record.faceMatch.message);
    }
    try {
      await saveStage(record, 'faceMatch', (requestId) => verifyFaceMatch({ selfie: payload.selfieBase64, identityPhoto, requestId }),
        (data) => faceMatchPassed(data));
    } catch (error) {
      if (!(error instanceof SignCareError)) throw error;
      record.faceMatch = {
        status: 'REVIEW',
        requestId: record.faceMatch?.requestId || signcareRequestId('KP-faceMatch'),
        message: 'Live selfie captured. Khatu Pay will review the face match.',
        updatedAt: new Date(),
        data: { providerError: error.data || null },
      };
      await record.save();
    }
    ok(res, publicStage(record.faceMatch), record.faceMatch.message);
  } catch (error) { next(error); }
});

router.get('/account-aggregator/status', requireAuth, async (req, res, next) => {
  try {
    const record = await requireConsent(req.user.uid);
    record.accountAggregator = {
      status: signcareConfig.wealthSyncEnabled ? 'PENDING' : 'NOT_STARTED',
      message: signcareConfig.wealthSyncEnabled
        ? 'Account Aggregator consent can be started.'
        : 'Account Aggregator will be available after SignCare WealthSync activation.',
      updatedAt: new Date(),
    };
    await record.save();
    ok(res, publicStage(record.accountAggregator));
  } catch (error) { next(error); }
});

router.post('/bank', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object({ accountNumber: Joi.string().pattern(/^\d{9,18}$/).required(), ifsc: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/i).required() }).validateAsync(req.body);

    const record = await requireConsent(req.user.uid);
    const requestId = signcareRequestId('KP-BANK-PENNYDROP');
    record.bank = { status: 'PENDING', requestId, message: 'Bank account verification in progress.', updatedAt: new Date() };
    await record.save();

    let result;
    try {
      result = await verifyBankAccount({
        accountNumber: payload.accountNumber,
        ifscCode: payload.ifsc,
        ifsc: payload.ifsc,
        consentText: CONSENT_TEXT,
        requestId,
      });
    } catch (error) {
      if (!(error instanceof SignCareError)) throw error;
      record.bank = {
        status: 'FAILED',
        requestId,
        message: error.message,
        updatedAt: new Date(),
        data: { provider: 'SIGNCARE_PENNY_DROP_BASIC', providerError: error.data || null },
      };
      await record.save();
      return fail(res, 'BANK_VERIFICATION_UNAVAILABLE', error.message, error.status || 503);
    }
    const normalized = normalizeSigncarePennyDrop(result.response, {
      accountNumber: payload.accountNumber,
      ifsc: payload.ifsc,
    });
    record.bank = {
      status: normalized.isValid ? 'VERIFIED' : 'FAILED',
      requestId: result.requestId || requestId,
      providerReference: normalized.requestId || result.requestId || requestId,
      message: normalized.message,
      ...(normalized.isValid ? { verifiedAt: new Date() } : {}),
      updatedAt: new Date(),
      data: { ...normalized, provider: 'SIGNCARE_PENNY_DROP_BASIC' },
    };
    await record.save();
    if (!normalized.isValid) {
      if (/max\s*retries|timeout|timed\s*out/i.test(`${normalized.bankResponse} ${normalized.message}`)) {
        const last4 = String(payload.accountNumber).slice(-4);
        record.bank = {
          ...record.bank,
          status: 'REVIEW',
          message: `Bank details submitted for Khatu Pay review. IFSC ${payload.ifsc.toUpperCase()}, account ending ${last4}.`,
          updatedAt: new Date(),
          data: { ...normalized, provider: 'SIGNCARE_PENNY_DROP_BASIC', reviewReason: 'PROVIDER_RETRY_LIMIT' },
        };
        await record.save();
        return ok(res, publicStage(record.bank), record.bank.message);
      }
      return fail(res, 'BANK_VERIFICATION_FAILED', normalized.message, 400, normalized);
    }

    ok(res, publicStage(record.bank), record.bank.message);
  } catch (error) { next(error); }
});

router.post('/upi', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object({
      upiId: Joi.string().trim().lowercase().pattern(/^[a-z0-9.\-_]{2,}@[a-z0-9.\-_]{2,}$/i).required(),
    }).validateAsync(req.body);
    const record = await requireConsent(req.user.uid);
    const requestId = signcareRequestId('KP-UPI-SIGNCARE');
    record.upi = { status: 'PENDING', requestId, message: 'UPI verification in progress.', updatedAt: new Date() };
    await record.save();
    const result = await verifyUpiName({
      upiId: payload.upiId,
      consentText: CONSENT_TEXT,
      requestId,
    });
    const normalized = normalizeSigncareUpiName(result.response, { upiId: payload.upiId });
    record.upi = {
      status: normalized.isValid ? 'VERIFIED' : 'FAILED',
      requestId: result.requestId || requestId,
      providerReference: normalized.requestId || result.requestId || requestId,
      message: normalized.message,
      ...(normalized.isValid ? { verifiedAt: new Date() } : {}),
      updatedAt: new Date(),
      data: { ...normalized, provider: 'SIGNCARE_UPI_ID_TO_NAME' },
    };
    await record.save();
    if (!normalized.isValid) {
      return fail(res, 'UPI_VERIFICATION_FAILED', normalized.message, 400, normalized);
    }
    ok(res, publicStage(record.upi), record.upi.message);
  } catch (error) { next(error); }
});

router.post('/bank-statement/analyse', requireAuth, acceptStatement, async (req, res, next) => {
  try {
    if (!req.file?.buffer) return fail(res, 'STATEMENT_REQUIRED', 'Select a PDF bank statement.', 400);
    const input = await Joi.object({
      password: Joi.string().allow('').max(100).default(''),
      accountType: Joi.string().valid('SALARIED', 'SME').default('SALARIED'),
    }).validateAsync(req.body || {});
    const record = await requireConsent(req.user.uid);
    const requestId = signcareRequestId('KP-BSA');
    record.bankStatement = { status: 'PENDING', requestId, message: 'Bank statement analysis started.', updatedAt: new Date() };
    await record.save();
    const result = await submitBankStatement({
      fileBase64: req.file.buffer.toString('base64'), password: input.password,
      accountType: input.accountType, consentText: CONSENT_TEXT, requestId,
    });
    const data = stageData(result.response);
    const orderId = String(data.orderId || data.order_id || '');
    if (!orderId) throw new SignCareError('Bank statement analysis order was not created.', 502, data);
    record.bankStatement = {
      status: 'PENDING', requestId: result.requestId, providerReference: orderId,
      message: 'Bank statement is being analysed.', updatedAt: new Date(), data: { orderId },
    };
    await record.save();
    ok(res, { ...publicStage(record.bankStatement), orderId }, 'Bank statement analysis started.');
  } catch (error) { next(error); }
});

router.post('/bank-statement/status', requireAuth, async (req, res, next) => {
  try {
    const { orderId } = await Joi.object({ orderId: Joi.string().required() }).validateAsync(req.body);
    const record = await requireConsent(req.user.uid);
    if (record.bankStatement?.providerReference && record.bankStatement.providerReference !== orderId) {
      return fail(res, 'INVALID_ORDER', 'This bank statement request does not belong to your account.', 403);
    }
    const result = await getBankStatementAnalysis({
      orderId, consentText: CONSENT_TEXT,
      requestId: record.bankStatement?.requestId || signcareRequestId('KP-BSA-STATUS'),
    });
    const data = stageData(result.response);
    const report = data.jsonDetails || data.json_details;
    const verified = Boolean(report?.statementAccount || report?.consolidatedinfo);
    record.bankStatement = {
      status: verified ? 'VERIFIED' : 'PENDING', requestId: result.requestId,
      providerReference: orderId,
      message: verified ? 'Bank statement analysed successfully.' : 'Bank statement analysis is still processing.',
      ...(verified ? { verifiedAt: new Date() } : {}), updatedAt: new Date(), data,
    };
    await record.save();
    ok(res, publicStage(record.bankStatement), record.bankStatement.message);
  } catch (error) { next(error); }
});

router.post('/credit-report', requireAuth, async (req, res, next) => {
  try {
    // Auto-accept consent if not already done.
    const record = await getRecord(req.user.uid);
    if (!record.consent?.accepted) {
      record.consent = {
        accepted: true, text: CONSENT_TEXT, version: '2026-09',
        acceptedAt: new Date(), ipAddress: req.ip, userAgent: req.get('user-agent') || '',
      };
      await record.save();
    }

    const user = await User.findById(req.user.uid).lean();
    await hydrateIdentityFromUserKyc(record, user);

    const required = ['pan', 'aadhaar', 'liveness', 'faceMatch', 'bank'];
    const acceptableStatus = (stage, status) =>
      status === 'VERIFIED' || (['liveness', 'faceMatch', 'bank'].includes(stage) && status === 'REVIEW');
    const incomplete = required.find((stage) => !acceptableStatus(stage, record?.[stage]?.status));
    if (incomplete) {
      return fail(res, 'SIGNCARE_VERIFICATION_REQUIRED', `Complete ${incomplete} verification before fetching the credit report.`, 409);
    }

    // Never spend a paid bureau call on a request SignCare is going to reject.
    const { request: retailRequest, missing, missingLabels } = buildExperianRetailRequest({ user, verification: record });
    if (missing.length) {
      return fail(
        res, 'CREDIT_PROFILE_INCOMPLETE',
        `We could not read your ${missingLabels.join(', ')} from your KYC. Please complete KYC verification again and retry.`,
        422,
      );
    }

    // The same identity was already pulled recently - reuse it instead of buying it again.
    if (reusableCreditStage(record.credit, retailRequest)) {
      return ok(res, publicStage(record.credit), 'Your recent credit report is already on file.');
    }

    // Atomic claim: two overlapping taps (or a retry after an app timeout) must not
    // each trigger a paid call. A PENDING row older than the provider timeout is a crash leftover.
    const requestId = signcareRequestId('KP-CREDIT-RETAIL');
    const claimed = await LoanVerification.findOneAndUpdate(
      {
        _id: record._id,
        $or: [
          { 'credit.status': { $ne: 'PENDING' } },
          { 'credit.updatedAt': { $lt: new Date(Date.now() - CREDIT_PENDING_STALE_MS) } },
        ],
      },
      {
        $set: {
          credit: {
            status: 'PENDING', requestId, message: 'Credit report fetch in progress.', updatedAt: new Date(),
            data: { provider: EXPERIAN_PROVIDER, request: retailRequest },
          },
        },
      },
      { new: true },
    );
    if (!claimed) {
      return fail(res, 'CREDIT_REPORT_IN_PROGRESS', 'Your credit report is already being fetched. Please wait a moment and try again.', 409);
    }

    let result;
    try {
      result = await fetchExperianReport(retailRequest, requestId);
    } catch (error) {
      claimed.credit = {
        status: 'FAILED', requestId, message: error.message, updatedAt: new Date(),
        data: { provider: EXPERIAN_PROVIDER, request: retailRequest, providerError: error.data || null },
      };
      await claimed.save();
      throw error;
    }

    const normalized = normalizeSigncareExperianRetail(result.response, { ...retailRequest, requestId });
    const verified = experianRetailVerified(normalized);
    const providerReference = normalized.summary.requestId || result.requestId || requestId;
    const status = verified ? 'VERIFIED' : 'REVIEW';

    // The full report (with its base64 workbook) lives in CreditReport; the loan
    // record keeps a lean copy so admin loan lists are not weighed down by it.
    let workbookStored = true;
    try {
      await CreditReport.findOneAndUpdate(
        { userId: req.user.uid, referenceId: providerReference },
        {
          userId: req.user.uid,
          provider: 'SignCare',
          environment: 'production',
          referenceId: providerReference,
          name: [retailRequest.firstName, retailRequest.lastName].filter(Boolean).join(' '),
          mobile: String(retailRequest.phoneNumber),
          panMasked: maskPan(retailRequest.pan),
          bureau: 'Experian',
          status,
          score: normalized.summary.score,
          purpose: 'Loan eligibility assessment',
          consent: {
            accepted: true,
            timestamp: claimed.consent?.acceptedAt || new Date(),
            ip: req.ip,
            userAgent: req.get('user-agent') || '',
          },
          request: retailRequest,
          response: normalized,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (storeError) {
      workbookStored = false;
      console.error('Credit report archive write failed', storeError.message);
    }

    const now = new Date();
    claimed.credit = {
      status,
      requestId: result.requestId || requestId,
      providerReference,
      message: experianStageMessage(verified),
      ...(verified ? { verifiedAt: now } : {}),
      updatedAt: now,
      data: workbookStored ? detachExcelReport(normalized).lean : normalized,
    };
    await claimed.save();

    // REVIEW is a real outcome (no bureau history / unmatched profile), not an
    // error: the application can still be submitted and the credit team decides.
    ok(res, publicStage(claimed.credit), claimed.credit.message);
  } catch (error) { next(error); }
});

router.get('/admin/:userId/credit-report/excel', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return fail(res, 'INVALID_USER', 'Invalid user id.', 400);
    }
    const record = await LoanVerification.findOne({ userId: req.params.userId }).select('credit').lean();
    const credit = record?.credit || {};
    if (!credit.providerReference && !credit.data?.excelExperianReport) {
      return fail(res, 'CREDIT_REPORT_NOT_FOUND', 'No credit report has been fetched for this customer.', 404);
    }

    const archived = credit.providerReference
      ? await CreditReport.findOne({ userId: req.params.userId, referenceId: credit.providerReference })
        .select('response.excelExperianReport panMasked').lean()
      : null;
    const workbook = decodeExperianExcel(archived?.response?.excelExperianReport || credit.data?.excelExperianReport);
    if (!workbook) {
      return fail(res, 'CREDIT_EXCEL_UNAVAILABLE', 'The bureau did not return an Excel workbook for this report.', 404);
    }

    await AuditLog.create({
      actorId: req.admin.id, action: 'DOWNLOAD_CREDIT_REPORT', entityType: 'CreditReport',
      entityId: String(credit.providerReference || req.params.userId),
      meta: { userId: req.params.userId, format: 'xlsx' },
    }).catch((auditError) => console.error('Credit report audit log failed', auditError.message));

    const suffix = String(credit.data?.summary?.reportNumber || credit.providerReference || 'report').replace(/[^\w-]/g, '');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="experian-credit-report-${suffix}.xlsx"`,
      'Content-Length': workbook.length,
      'Cache-Control': 'no-store',
    });
    res.send(workbook);
  } catch (error) { next(error); }
});

router.get('/admin/:userId', requireAdmin, async (req, res, next) => {
  try { const record = await getRecord(req.params.userId); ok(res, present(record, true)); } catch (error) { next(error); }
});

router.post('/admin/loan/:loanId/estamp', requireAdmin, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.loanId);
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found.', 404);
    const record = await getRecord(loan.userId);
    await saveStage(record, 'eStamp', (requestId) => createEStamp(req.body, requestId), () => false);
    ok(res, publicStage(record.eStamp), 'eStamp workflow started.');
  } catch (error) { next(error); }
});

router.post('/admin/loan/:loanId/esign', requireAdmin, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.loanId);
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found.', 404);
    const record = await getRecord(loan.userId);
    await saveStage(record, 'eSign', (requestId) => createESign(req.body, requestId), () => false);
    ok(res, publicStage(record.eSign), 'Agreement sent for Aadhaar eSign.');
  } catch (error) { next(error); }
});

router.post('/admin/loan/:loanId/esign/status', requireAdmin, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.loanId); if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found.', 404);
    const record = await getRecord(loan.userId); const result = await getESignStatus(req.body, record.eSign.requestId || signcareRequestId('KP-ESIGN'));
    const data = stageData(result.response); const completed = String(data.documentStatus || data.status || '').toUpperCase() === 'COMPLETED';
    record.eSign = { ...(record.eSign?.toObject?.() || record.eSign || {}), status: completed ? 'VERIFIED' : 'PENDING', message: completed ? 'Agreement signed.' : 'Signature pending.', ...(completed ? { verifiedAt: new Date() } : {}), updatedAt: new Date(), data };
    await record.save(); ok(res, publicStage(record.eSign));
  } catch (error) { next(error); }
});

router.get('/admin/loan/:loanId/esign/audit/:documentId', requireAdmin, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.loanId); if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found.', 404);
    const record = await getRecord(loan.userId); const result = await getESignAudit(req.params.documentId, signcareRequestId('KP-AUDIT'));
    record.auditTrail = { status: 'VERIFIED', requestId: result.requestId, providerReference: req.params.documentId, message: 'Audit trail fetched.', verifiedAt: new Date(), updatedAt: new Date(), data: stageData(result.response) };
    await record.save(); ok(res, publicStage(record.auditTrail));
  } catch (error) { next(error); }
});

router.use((error, _req, res, next) => {
  if (error instanceof SignCareError || error.isJoi || error.status) {
    return fail(res, error.code || (error instanceof SignCareError ? 'SIGNCARE_REQUEST_FAILED' : 'INVALID_REQUEST'), error.message, error.status || 400, error.data || undefined);
  }
  next(error);
});

export default router;
