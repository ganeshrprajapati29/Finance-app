import { Router } from 'express';
import Joi from 'joi';
import LoanVerification from '../models/LoanVerification.js';
import Loan from '../models/Loan.js';
import User from '../models/User.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';
import signcareConfig from '../config/signcare.js';
import {
  SignCareError, createESign, createEStamp, fetchExperianReport, getAadhaarOvseResult,
  getESignAudit, getESignStatus, initAadhaarOvse, publicSigncareConfig, signcareRequestId,
  verifyBankAccount, verifyFaceMatch, verifyLiveness, verifyPan,
} from '../services/signcare.js';

const router = Router();
const CONSENT_TEXT = 'I consent to Khatu Pay verifying my identity, bank account and credit information through SignCare for loan eligibility assessment.';
const STAGES = ['pan', 'aadhaar', 'liveness', 'faceMatch', 'bank', 'credit', 'accountAggregator', 'agreement', 'eStamp', 'eSign', 'auditTrail'];

const getRecord = (userId) => LoanVerification.findOneAndUpdate(
  { userId }, { $setOnInsert: { userId, provider: 'SIGNCARE' } }, { new: true, upsert: true, setDefaultsOnInsert: true }
);

function publicStage(stage = {}) {
  const data = stage.data || {};
  return {
    status: stage.status || 'NOT_STARTED', requestId: stage.requestId || '',
    providerReference: stage.providerReference || '', message: stage.message || '',
    verifiedAt: stage.verifiedAt || null, updatedAt: stage.updatedAt || null,
    summary: {
      name: data.name || data.fullName || data.residentName || data.accountHolderName || '',
      score: data.score ?? data.creditScore ?? data.livenessScore ?? data.matchScore ?? null,
      bankName: data.bankName || '', documentStatus: data.documentStatus || '',
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
const referenceOf = (data = {}) => String(data.txnId || data.transactionId || data.documentId || data.referenceId || data.orderId || '');
const verifiedFlag = (data = {}, keys = []) => keys.some((key) => data?.[key] === true) ||
  ['SUCCESS', 'VERIFIED', 'COMPLETED'].includes(String(data.status || data.verificationStatus || '').toUpperCase());

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
    const payload = await Joi.object({ pan: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/i).required(), name: Joi.string().min(2).max(120).required(), dob: Joi.string().allow('') }).validateAsync(req.body);
    const record = await requireConsent(req.user.uid);
    await saveStage(record, 'pan', (requestId) => verifyPan({ ...payload, consentText: CONSENT_TEXT, requestId }),
      (data) => data.valid === true || data.verified === true || verifiedFlag(data, ['panValid', 'nameMatched']));
    const data = record.pan.data || {};
    await User.findByIdAndUpdate(req.user.uid, { $set: {
      'kyc.panNumber': payload.pan.toUpperCase(), 'kyc.panVerified': record.pan.status === 'VERIFIED',
      'kyc.panName': data.name || data.panHolderName || payload.name,
      'kyc.panData': data, 'kyc.panVerification': { provider: 'SIGNCARE', requestId: record.pan.requestId, verifiedAt: record.pan.verifiedAt, response: data },
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
    await saveStage(record, 'liveness', (requestId) => verifyLiveness({ image: imageBase64, requestId }),
      (data) => data.isLive === true && data.multipleFacesDetected !== true && data.reviewNeeded !== true);
    ok(res, publicStage(record.liveness), record.liveness.message);
  } catch (error) { next(error); }
});

router.post('/face-match', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object({ selfieBase64: Joi.string().min(100).required(), identityPhotoBase64: Joi.string().min(100).optional() }).validateAsync(req.body);
    const record = await requireConsent(req.user.uid);
    const identityPhoto = payload.identityPhotoBase64 || record.aadhaar?.data?.photo || record.aadhaar?.data?.residentPhoto;
    if (!identityPhoto) return fail(res, 'IDENTITY_PHOTO_REQUIRED', 'Complete Aadhaar verification before face matching.', 400);
    await saveStage(record, 'faceMatch', (requestId) => verifyFaceMatch({ selfie: payload.selfieBase64, identityPhoto, requestId }),
      (data) => data.match === true || data.matched === true || data.isMatched === true || Number(data.matchScore || data.score || 0) >= 70);
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
    await saveStage(record, 'bank', (requestId) => verifyBankAccount({ ...payload, consentText: CONSENT_TEXT, requestId }),
      (data) => data.valid === true || data.verified === true || data.accountExists === true || verifiedFlag(data, ['isValid']));
    ok(res, publicStage(record.bank), record.bank.message);
  } catch (error) { next(error); }
});

router.post('/credit-report', requireAuth, async (req, res, next) => {
  try {
    const record = await requireConsent(req.user.uid);
    const user = await User.findById(req.user.uid).lean();
    const aadhaar = record.aadhaar?.data || {};
    const fullName = String(record.pan?.data?.name || record.pan?.data?.panHolderName || user?.name || '').trim();
    const names = fullName.split(/\s+/).filter(Boolean);
    const dobRaw = String(aadhaar.dob || aadhaar.dateOfBirth || user?.kyc?.dob || '');
    const dateOfBirth = /^\d{2}-\d{2}-\d{4}$/.test(dobRaw)
      ? dobRaw.split('-').reverse().join('-') : dobRaw;
    const payload = {
      phoneNumber: String(user?.mobile || '').replace(/\D/g, '').slice(-10),
      pan: String(user?.kyc?.panNumber || '').toUpperCase(),
      firstName: names[0] || '', lastName: names.slice(1).join(' ') || names[0] || '',
      dateOfBirth,
      pincode: String(aadhaar.pincode || aadhaar.pinCode || aadhaar.address?.pincode || aadhaar.address?.pc || user?.address?.pincode || ''),
    };
    await Joi.object({ phoneNumber: Joi.string().pattern(/^[6-9]\d{9}$/).required(), pan: Joi.string().pattern(/^[A-Z]{5}\d{4}[A-Z]$/).required(), firstName: Joi.string().required(), lastName: Joi.string().required(), dateOfBirth: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(), pincode: Joi.string().pattern(/^\d{6}$/).required() }).validateAsync(payload);
    for (const stage of ['pan', 'aadhaar', 'liveness', 'faceMatch']) {
      if (record[stage]?.status !== 'VERIFIED') return fail(res, 'VERIFICATION_INCOMPLETE', `Complete ${stage} verification first.`, 409);
    }
    await saveStage(record, 'credit', (requestId) => fetchExperianReport({ ...payload, phoneNumber: Number(payload.phoneNumber), pincode: Number(payload.pincode), pan: payload.pan.toUpperCase() }, requestId), () => true);
    ok(res, publicStage(record.credit), 'Credit report received for review.');
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
