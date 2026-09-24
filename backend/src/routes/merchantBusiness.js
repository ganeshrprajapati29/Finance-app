import crypto from 'crypto';
import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import MerchantBusiness from '../models/MerchantBusiness.js';
import MerchantBankAccount from '../models/MerchantBankAccount.js';
import MerchantKyc from '../models/MerchantKyc.js';
import MerchantQR from '../models/MerchantQR.js';
import User from '../models/User.js';
import { created, fail, ok } from '../utils/response.js';
import { verifyBankAccount, signcareRequestId } from '../services/signcare.js';
import { normalizeSigncarePennyDrop } from '../utils/signcareBankVerification.js';
import { activateMerchantQr } from '../utils/merchantQr.js';
import { notifyUserSmart } from '../services/smartNotifications.js';

const router = Router();
const profileSchema = Joi.object({
  businessName: Joi.string().trim().min(2).max(100).required(),
  ownerName: Joi.string().trim().min(2).max(100).required(),
  category: Joi.string().trim().min(2).max(80).required(),
  mobile: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
  email: Joi.string().email().allow(''), address: Joi.string().trim().max(300).allow(''),
});

const dashboardFor = async (userId) => {
  const business = await MerchantBusiness.findOne({ userId });
  if (!business) return null;
  const [kyc, bank, qr] = await Promise.all([
    MerchantKyc.findOne({ businessId: business._id }),
    MerchantBankAccount.findOne({ businessId: business._id }),
    MerchantQR.findOne({ businessId: business._id }),
  ]);
  return { business, kyc, bank: bank ? { ...bank.toObject(), accountNumber: `****${bank.accountNumber.slice(-4)}` } : null, qr };
};

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (await MerchantBusiness.exists({ userId: req.user.uid })) return fail(res, 'BUSINESS_EXISTS', 'Your business profile already exists.', 409);
    const payload = await profileSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const business = await MerchantBusiness.create({ ...payload, userId: req.user.uid, publicId: `KPB${Date.now()}${crypto.randomInt(100, 999)}` });
    created(res, business, 'Business profile created. Complete KYC and bank verification next.');
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try { ok(res, await dashboardFor(req.user.uid)); } catch (error) { next(error); }
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const payload = await profileSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const business = await MerchantBusiness.findOneAndUpdate({ userId: req.user.uid, status: { $in: ['DRAFT', 'REJECTED'] } }, payload, { new: true });
    if (!business) return fail(res, 'PROFILE_LOCKED', 'Submitted business details cannot be edited right now.', 409);
    ok(res, business, 'Business profile updated.');
  } catch (error) { next(error); }
});

router.post('/kyc', requireAuth, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    if (!business) return fail(res, 'PROFILE_REQUIRED', 'Create your business profile first.', 409);
    const payload = await Joi.object({
      gstNumber: Joi.string().uppercase().max(15).allow(''), businessType: Joi.string().required(),
      businessProofUrl: Joi.string().uri().allow(''),
    }).validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const user = await User.findById(req.user.uid).select('kyc');
    if (user?.kyc?.panVerified !== true || user?.kyc?.aadhaarVerified !== true) {
      return fail(res, 'PERSONAL_KYC_REQUIRED', 'Complete PAN and Aadhaar verification before business KYC.', 409);
    }
    const kyc = await MerchantKyc.findOneAndUpdate({ businessId: business._id }, {
      panNumber: user.kyc.panNumber, gstNumber: payload.gstNumber,
      businessType: payload.businessType, userId: req.user.uid,
      documents: { businessProofUrl: payload.businessProofUrl },
      status: 'PENDING', submittedAt: new Date()
    }, { upsert: true, new: true });
    business.status = 'SUBMITTED'; await business.save();
    notifyUserSmart(req.user.uid, 'business_qr_pending', {
      email: true,
      force: true,
      businessName: business.businessName,
      reference: business.publicId,
      route: '/business',
      dedupeKey: `business-qr-pending:${business._id}:${new Date().toISOString().slice(0, 10)}`,
      data: { businessId: String(business._id), publicId: business.publicId, status: business.status },
    }).catch((error) => console.error('Business QR pending email failed:', error.message));
    ok(res, kyc, 'Business KYC submitted for review.');
  } catch (error) { next(error); }
});

router.post('/bank-account', requireAuth, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    if (!business) return fail(res, 'PROFILE_REQUIRED', 'Create your business profile first.', 409);
    const payload = await Joi.object({
      accountHolderName: Joi.string().min(2).required(), accountNumber: Joi.string().pattern(/^\d{6,20}$/).required(),
      ifscCode: Joi.string().uppercase().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(), bankName: Joi.string().allow(''),
    }).validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const requestId = signcareRequestId('KP-MERCHANT-BANK');
    const result = await verifyBankAccount({
      accountNumber: payload.accountNumber,
      ifsc: payload.ifscCode,
      consentText: 'I consent to Khatu Pay verifying my merchant settlement bank account through SignCare Penny Drop Basic.',
      requestId,
    });
    const normalized = normalizeSigncarePennyDrop(result.response, {
      accountNumber: payload.accountNumber,
      ifsc: payload.ifscCode,
    });
    const temporaryReview = !normalized.isValid &&
      /max\s*retries|timeout|timed\s*out/i.test(`${normalized.bankResponse} ${normalized.message}`);
    const last4 = payload.accountNumber.slice(-4);
    const reviewMessage = `Bank details submitted for Khatu Pay review. IFSC ${payload.ifscCode.toUpperCase()}, account ending ${last4}.`;
    const bank = await MerchantBankAccount.findOneAndUpdate(
      { businessId: business._id },
      {
        ...payload,
        accountHolderName: normalized.accountName || payload.accountHolderName,
        userId: req.user.uid,
        status: normalized.isValid ? 'VERIFIED' : temporaryReview ? 'REVIEW' : 'FAILED',
        ...(normalized.isValid ? { verifiedAt: new Date() } : {}),
        verificationReference: normalized.requestId || result.requestId || requestId,
        verificationProvider: 'SIGNCARE_PENNY_DROP_BASIC',
        verificationMessage: temporaryReview ? reviewMessage : normalized.message,
        verificationData: {
          ...normalized,
          ...(temporaryReview ? { status: 'REVIEW', message: reviewMessage, reviewReason: 'PROVIDER_RETRY_LIMIT' } : {}),
        },
      },
      { upsert: true, new: true },
    );
    if (!normalized.isValid && !temporaryReview) {
      return fail(res, 'BANK_VERIFICATION_FAILED', normalized.message, 400, normalized);
    }
    ok(
      res,
      { ...bank.toObject(), accountNumber: `****${bank.accountNumber.slice(-4)}` },
      temporaryReview ? reviewMessage : 'Merchant bank account verified successfully.',
    );
  } catch (error) { next(error); }
});

router.get('/status', requireAuth, async (req, res, next) => {
  try { ok(res, await dashboardFor(req.user.uid)); } catch (error) { next(error); }
});

router.post('/activate', requireAuth, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ userId: req.user.uid, status: 'APPROVED' });
    if (!business) return fail(res, 'APPROVAL_REQUIRED', 'Business approval is required before generating a QR.', 409);
    const qr = await activateMerchantQr(business, req.user.uid);
    ok(res, qr, 'Business QR activated.');
  } catch (error) { next(error); }
});

export default router;
