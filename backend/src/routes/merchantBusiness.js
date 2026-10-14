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
import { notifyUserSmart } from '../services/smartNotifications.js';
import { exchangeRazorpayOAuthCode, storeRazorpayOAuthToken, fetchRazorpayProductConfiguration, fetchRazorpaySubMerchant, fetchRazorpayTerms, mapRazorpayAccountStatus, razorpayOAuthAuthorizationUrl, updateRazorpayProductConfiguration, updateRazorpaySubMerchant, uploadRazorpayAccountDocument } from '../services/razorpayPartner.js';
import { SignCareError } from '../services/signcare.js';
import {
  RAZORPAY_CATEGORY_BY_BUSINESS_CATEGORY, applyProviderProduct, buildOnboardingChecklist, gstinProblem,
  normalizeGstin, settlementConfiguration, submitProviderOnboarding,
} from '../services/merchantOnboarding.js';

const router = Router();
const oauthStateHash = (state) => crypto.createHash('sha256').update(state).digest('hex');
const connectReturnUrl = () => String(process.env.MERCHANT_CONNECT_RETURN_URL || 'https://khatupay.com/loan-signing-complete').trim();
const safeBusiness = (business) => {
  if (!business) return business;
  const value = business.toObject ? business.toObject() : { ...business };
  if (value.razorpay) {
    delete value.razorpay.lastProviderError;
    delete value.razorpay.oauthAccessToken;
    delete value.razorpay.oauthRefreshToken;
    delete value.razorpay.oauthStateHash;
    delete value.razorpay.oauthStateExpiresAt;
  }
  return value;
};
const profileSchema = Joi.object({
  businessName: Joi.string().trim().min(2).max(100).required(),
  ownerName: Joi.string().trim().min(2).max(100).required(),
  category: Joi.string().trim().min(2).max(80).required(),
  mobile: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
  email: Joi.string().email().allow(''), address: Joi.string().trim().max(300).allow(''),
});
const dashboardFor = async (userId) => {
  const [business, user] = await Promise.all([
    MerchantBusiness.findOne({ userId }),
    User.findById(userId).select('name email mobile kyc.panVerified kyc.aadhaarVerified kyc.panName').lean(),
  ]);
  const personalKyc = {
    panVerified: user?.kyc?.panVerified === true,
    aadhaarVerified: user?.kyc?.aadhaarVerified === true,
    name: user?.kyc?.panName || user?.name || '',
  };
  if (!business) return { business: null, kyc: null, bank: null, qr: null, personalKyc, onboarding: buildOnboardingChecklist({ user }) };
  const [kyc, bank, storedQr] = await Promise.all([
    MerchantKyc.findOne({ businessId: business._id }),
    MerchantBankAccount.findOne({ businessId: business._id }),
    MerchantQR.findOne({ businessId: business._id }),
  ]);
  // QRs created with the previous collection provider no longer accept
  // payments, so they are not shown as a usable QR.
  const qr = storedQr?.provider === 'RAZORPAY_PARTNER' ? storedQr : null;
  return {
    business: safeBusiness(business), kyc,
    bank: bank ? { ...bank.toObject(), accountNumber: `****${bank.accountNumber.slice(-4)}`, verificationData: undefined } : null,
    qr, personalKyc,
    onboarding: buildOnboardingChecklist({ business, bank, qr, user }),
  };
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
    // Editable until the business is created at, or connected to, Razorpay.
    const business = await MerchantBusiness.findOneAndUpdate({
      userId: req.user.uid,
      status: { $in: ['DRAFT', 'SUBMITTED', 'REJECTED'] },
      'razorpay.accountId': { $in: [null, ''] },
      'razorpay.oauthConnectedAt': null,
    }, payload, { new: true });
    if (!business) return fail(res, 'PROFILE_LOCKED', 'Your business is already linked to Razorpay. Contact support to change these details.', 409);
    ok(res, business, 'Business profile updated.');
  } catch (error) { next(error); }
});

// Start the application again (new details, different business type, a fresh
// Razorpay connection). Only before anything exists at Razorpay.
router.post('/me/restart', requireAuth, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    if (!business) return fail(res, 'PROFILE_REQUIRED', 'Create your business profile first.', 409);
    if (business.razorpay?.accountId || business.razorpay?.oauthConnectedAt) {
      return fail(res, 'APPLICATION_LOCKED', 'Your business is already linked to Razorpay and cannot be restarted. Contact support for changes.', 409);
    }
    business.status = 'DRAFT';
    business.rejectionReason = undefined;
    business.onboardingRequest = undefined;
    business.razorpay = {};
    await business.save();
    ok(res, await dashboardFor(req.user.uid), 'Your application was reset. You can fill it again.');
  } catch (error) { next(error); }
});

router.post('/kyc', requireAuth, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    if (!business) return fail(res, 'PROFILE_REQUIRED', 'Create your business profile first.', 409);
    const gstError = gstinProblem(req.body?.gstNumber);
    if (gstError) return fail(res, 'GSTIN_INVALID', gstError, 400);
    const payload = await Joi.object({
      gstNumber: Joi.string().allow('').default(''), businessType: Joi.string().required(),
      businessProofUrl: Joi.string().allow(''), addressProofUrl: Joi.string().allow(''),
      gstCertificateUrl: Joi.string().allow(''), incorporationCertificateUrl: Joi.string().allow(''),
      stakeholderProofUrl: Joi.string().allow(''),
    }).validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const user = await User.findById(req.user.uid).select('kyc');
    if (user?.kyc?.panVerified !== true || user?.kyc?.aadhaarVerified !== true) {
      return fail(res, 'PERSONAL_KYC_REQUIRED', 'Complete PAN and Aadhaar verification before business KYC.', 409);
    }
    const kyc = await MerchantKyc.findOneAndUpdate({ businessId: business._id }, {
      panNumber: user.kyc.panNumber, gstNumber: normalizeGstin(payload.gstNumber),
      businessType: payload.businessType, userId: req.user.uid,
      documents: {
        businessProofUrl: payload.businessProofUrl,
        addressProofUrl: payload.addressProofUrl,
        gstCertificateUrl: payload.gstCertificateUrl,
        incorporationCertificateUrl: payload.incorporationCertificateUrl,
        stakeholderProofUrl: payload.stakeholderProofUrl,
      },
      status: 'PENDING', submittedAt: new Date()
    }, { upsert: true, new: true });
    // Uploading a document must not move an application that is already
    // under review (or approved) back to SUBMITTED.
    const firstSubmission = business.status === 'DRAFT';
    if (firstSubmission) { business.status = 'SUBMITTED'; await business.save(); }
    if (firstSubmission) notifyUserSmart(req.user.uid, 'business_qr_pending', {
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

const onboardingSchema = Joi.object({
  legalBusinessName: Joi.string().trim().min(4).max(200).required(),
  customerFacingBusinessName: Joi.string().trim().min(1).max(255).required(),
  businessType: Joi.string().valid('proprietorship', 'partnership', 'private_limited', 'public_limited', 'llp', 'trust', 'society', 'individual', 'not_yet_registered').required(),
  businessModel: Joi.string().trim().min(4).max(255).required(),
  legalPan: Joi.string().uppercase().pattern(/^[A-Z]{5}\d{4}[A-Z]$/).allow(''),
  gstNumber: Joi.string().allow('').default(''),
  cin: Joi.string().uppercase().max(24).allow(''),
  ownership: Joi.number().min(1).max(100).default(100),
  address: Joi.object({
    street1: Joi.string().trim().max(100).required(), street2: Joi.string().trim().max(100).allow(''),
    city: Joi.string().trim().max(100).required(), state: Joi.string().trim().min(2).max(100).required(),
    postalCode: Joi.string().pattern(/^\d{6}$/).required(),
  }).required(),
  termsAccepted: Joi.boolean().valid(true).required(),
});

router.post('/razorpay/onboard', requireAuth, async (req, res, next) => {
  try {
    const gstError = gstinProblem(req.body?.gstNumber);
    if (gstError) return fail(res, 'GSTIN_INVALID', gstError, 400);
    const payload = await onboardingSchema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    payload.gstNumber = normalizeGstin(payload.gstNumber);
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    if (!business) return fail(res, 'PROFILE_REQUIRED', 'Create your business profile first.', 409);
    if (!RAZORPAY_CATEGORY_BY_BUSINESS_CATEGORY[business.category]) return fail(res, 'BUSINESS_CATEGORY_UNSUPPORTED', 'Select a supported business category before submitting business details.', 400);
    if (business.razorpay?.productId) return fail(res, 'ONBOARDING_ALREADY_STARTED', 'Your business details are already submitted and under verification.', 409);
    const user = await User.findById(req.user.uid).select('name email mobile kyc');
    if (!user?.kyc?.panVerified || !user?.kyc?.panNumber) return fail(res, 'PERSONAL_KYC_REQUIRED', 'Complete PAN verification before submitting business details.', 409);
    if (!(business.email || user.email)) return fail(res, 'EMAIL_REQUIRED', 'Add an email address to your business profile before submitting.', 409);

    // Saved first: whatever happens with the provider, the owner never has to
    // fill this form again.
    business.onboardingRequest = { ...payload, submittedAt: new Date() };
    if (!business.razorpay) business.razorpay = {};
    business.razorpay.termsAcceptedAt = new Date();
    if (business.status === 'DRAFT' || business.status === 'REJECTED') business.status = 'SUBMITTED';
    await business.save();

    const result = await submitProviderOnboarding(business, user);
    notifyUserSmart(req.user.uid, 'business_qr_pending', {
      email: true, force: true, businessName: business.businessName, reference: business.publicId, route: '/business',
      dedupeKey: `business-qr-pending:${business._id}:${new Date().toISOString().slice(0, 10)}`,
      data: { businessId: String(business._id), publicId: business.publicId, status: business.status },
    }).catch((error) => console.error('Business QR pending email failed:', error.message));
    ok(res, {
      ...(await dashboardFor(req.user.uid)),
      queued: result.queued,
    }, result.queued
      ? 'Business details submitted. The KhatuPay team will activate payments and notify you.'
      : 'Business details submitted for verification.');
  } catch (error) { next(error); }
});

router.get('/razorpay/terms', requireAuth, async (_req, res, next) => {
  try {
    const terms = await fetchRazorpayTerms();
    ok(res, { id: terms.id, terms: terms.tnc?.terms, privacy: terms.tnc?.privacy, agreement: terms.tnc?.agreement, lastPublishedAt: terms.last_published_at });
  } catch (error) { next(error); }
});

router.post('/razorpay/oauth/start', requireAuth, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    if (!business) return fail(res, 'PROFILE_REQUIRED', 'Create your business profile first.', 409);
    if (['REJECTED', 'SUSPENDED'].includes(business.status)) return fail(res, 'BUSINESS_ON_HOLD', 'Your business is on hold. Please contact KhatuPay support.', 409);
    const owner = await User.findById(req.user.uid).select('kyc.panVerified kyc.aadhaarVerified').lean();
    if (owner?.kyc?.panVerified !== true || owner?.kyc?.aadhaarVerified !== true) {
      return fail(res, 'PERSONAL_KYC_REQUIRED', 'Verify your PAN and Aadhaar before connecting Razorpay.', 409);
    }
    const state = crypto.randomBytes(32).toString('base64url');
    business.razorpay = {
      ...(business.razorpay?.toObject?.() || business.razorpay || {}),
      oauthStateHash: oauthStateHash(state), oauthStateExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };
    await business.save();
    ok(res, { authorizationUrl: razorpayOAuthAuthorizationUrl(state) }, 'Continue in Razorpay to authorise this business account.');
  } catch (error) { next(error); }
});

// Razorpay redirects here after the owner authorises KhatuPay. The same handler
// is also mounted at /api/razorpay-partner/oauth/callback, the redirect URL
// registered on the Razorpay partner app, so either registration works.
export async function razorpayOAuthCallback(req, res) {
  const state = String(req.query?.state || '');
  const code = String(req.query?.code || '');
  const providerError = String(req.query?.error_description || req.query?.error || '');
  // The app shows this flow in a WebView that closes itself on this URL; in a
  // normal browser the website shows the same result.
  const finish = (status, message) => res.redirect(303, `${connectReturnUrl()}?flow=razorpay&status=${status}${message ? `&message=${encodeURIComponent(message)}` : ''}`);
  if (!state || !code || providerError) {
    if (state || providerError) console.warn('[razorpay-partner] OAuth callback without code:', providerError || 'no code');
    return finish('failed', /denied|cancel/i.test(providerError) ? 'You cancelled the Razorpay connection.' : 'Razorpay connection was not completed.');
  }
  try {
    const business = await MerchantBusiness.findOne({ 'razorpay.oauthStateHash': oauthStateHash(state), 'razorpay.oauthStateExpiresAt': { $gt: new Date() } });
    if (!business) {
      console.warn('[razorpay-partner] OAuth callback with unknown or expired state');
      return finish('failed', 'This link expired. Please start the Razorpay connection again from the app.');
    }
    const token = await exchangeRazorpayOAuthCode(code);
    storeRazorpayOAuthToken(business, token);
    business.razorpay.oauthConnectedAt = new Date();
    business.razorpay.oauthStateHash = undefined;
    business.razorpay.oauthStateExpiresAt = undefined;
    business.razorpay.providerState = 'CONNECTED';
    if (['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION'].includes(business.status)) business.status = 'APPROVED';
    await business.save();
    return finish('completed');
  } catch (error) {
    console.error('[razorpay-partner] OAuth callback failed:', error.message);
    return finish('failed', 'The Razorpay account could not be connected. Please try again.');
  }
}
router.get('/razorpay/oauth/callback', razorpayOAuthCallback);

router.post('/razorpay/sync', requireAuth, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    if (!business) return fail(res, 'PROFILE_REQUIRED', 'Create your business profile first.', 409);
    // A merchant connected through Razorpay's own page has nothing to sync here.
    if (business.razorpay?.oauthConnectedAt && !business.razorpay?.productId) {
      return ok(res, { ...(await dashboardFor(req.user.uid)), queued: false, requirements: [] }, 'Your Razorpay account is connected.');
    }
    if (!business?.razorpay?.accountId && !business?.onboardingRequest) return fail(res, 'ONBOARDING_NOT_STARTED', 'Connect your Razorpay account first.', 409);
    // A queued or half-finished application: refreshing simply tries the
    // remaining provider steps again.
    if (!business.razorpay?.productId) {
      const user = await User.findById(req.user.uid).select('name email mobile kyc');
      const result = await submitProviderOnboarding(business, user);
      return ok(res, { ...(await dashboardFor(req.user.uid)), queued: result.queued, requirements: business.razorpay?.requirements || [] },
        result.queued ? 'Your application is with the KhatuPay team for activation.' : 'Business verification status updated.');
    }
    const account = await fetchRazorpaySubMerchant(business.razorpay.accountId);
    business.status = mapRazorpayAccountStatus(account.status);
    business.razorpay.accountStatus = account.status;
    business.razorpay.requirements = account.requirements;
    if (business.razorpay.productId) {
      const product = await fetchRazorpayProductConfiguration(business.razorpay.accountId, business.razorpay.productId);
      applyProviderProduct(business, product);
    }
    business.razorpay.lastSyncedAt = new Date();
    await business.save();
    ok(res, { ...(await dashboardFor(req.user.uid)), requirements: business.razorpay.requirements || [] }, 'Business verification status updated.');
  } catch (error) { next(error); }
});

router.patch('/razorpay/product', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object({
      businessModel: Joi.string().trim().min(4).max(255).required(),
      termsAccepted: Joi.boolean().valid(true).required(),
    }).validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    if (!business?.razorpay?.accountId || !business.razorpay.productId) {
      return fail(res, 'PRODUCT_NOT_READY', 'Complete business onboarding before updating payment-product details.', 409);
    }
    if (!['NEEDS_CLARIFICATION', 'SUBMITTED'].includes(business.status)) {
      return fail(res, 'PRODUCT_UPDATE_UNAVAILABLE', 'Payment-product details cannot be changed at the current verification stage.', 409);
    }
    const bank = await MerchantBankAccount.findOne({
      businessId: business._id,
      status: 'VERIFIED',
    });
    if (!bank) {
      return fail(res, 'SETTLEMENT_BANK_REQUIRED', 'Verify the settlement bank account before updating payment-product details.', 409);
    }
    await updateRazorpaySubMerchant(business.razorpay.accountId, {
      profile: { business_model: payload.businessModel },
    });
    const product = await updateRazorpayProductConfiguration(
      business.razorpay.accountId,
      business.razorpay.productId,
      settlementConfiguration(bank),
    );
    applyProviderProduct(business, product);
    business.razorpay.clarificationUpdatedAt = new Date();
    business.razorpay.lastSyncedAt = new Date();
    await business.save();
    ok(res, { business: safeBusiness(business), requirements: business.razorpay.requirements || [] }, 'Updated payment-product details were submitted to Razorpay.');
  } catch (error) { next(error); }
});

const providerDocumentTypes = new Set([
  'shop_establishment_certificate',
  'gst_certificate',
  'msme_certificate',
  'business_proof_url',
  'business_pan_url',
  'form_12_a_url',
  'form_80g_url',
  'cancelled_cheque',
]);

router.post('/razorpay/documents', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object({
      documents: Joi.array().items(Joi.object({
        documentType: Joi.string().valid(...providerDocumentTypes).required(),
        fileUrl: Joi.string().pattern(/^private:\/\//).required(),
      })).min(1).max(5).required(),
    }).validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    if (!business?.razorpay?.accountId) {
      return fail(res, 'ONBOARDING_NOT_STARTED', 'Submit business onboarding details before sending documents to Razorpay.', 409);
    }
    const state = String(business.razorpay.productStatus || '').toLowerCase();
    if (['under_review', 'activated', 'rejected', 'suspended'].includes(state)) {
      return fail(res, 'DOCUMENT_UPDATE_UNAVAILABLE', 'Razorpay is not accepting document changes at the current verification stage.', 409);
    }
    const existingUploads = business.razorpay.documentUploads || [];
    const documentsToUpload = payload.documents.filter((document) => !existingUploads.some(
      (existing) => existing.documentType === document.documentType && existing.sourceUrl === document.fileUrl,
    ));
    if (!documentsToUpload.length) {
      return ok(res, { uploaded: 0, business: safeBusiness(business) }, 'These business documents have already been submitted for verification.');
    }
    const uploads = [];
    for (const document of documentsToUpload) {
      const providerResponse = await uploadRazorpayAccountDocument(
        business.razorpay.accountId,
        document,
      );
      uploads.push({
        documentType: document.documentType,
        sourceUrl: document.fileUrl,
        providerResponse,
        uploadedAt: new Date(),
      });
    }
    business.razorpay.documentUploads = [
      ...existingUploads,
      ...uploads,
    ].slice(-20);
    business.razorpay.lastSyncedAt = new Date();
    await business.save();
    ok(res, { uploaded: uploads.length, business: safeBusiness(business) }, 'Business documents were submitted to Razorpay for verification.');
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
    let result;
    try {
      result = await verifyBankAccount({
        accountNumber: payload.accountNumber,
        ifsc: payload.ifscCode,
        consentText: 'I consent to Khatu Pay verifying my merchant settlement bank account through SignCare Penny Drop Basic.',
        requestId,
      });
    } catch (error) {
      // Verification provider is down or out of balance: keep the details and
      // let the KhatuPay team verify them, instead of failing the owner.
      if (!(error instanceof SignCareError)) throw error;
      const message = `Bank details received. KhatuPay will verify the account ending ${payload.accountNumber.slice(-4)}.`;
      const pending = await MerchantBankAccount.findOneAndUpdate(
        { businessId: business._id },
        {
          ...payload, userId: req.user.uid, status: 'REVIEW',
          verificationReference: requestId, verificationProvider: 'SIGNCARE_PENNY_DROP_BASIC',
          verificationMessage: message, verificationData: { status: 'REVIEW', reviewReason: 'PROVIDER_UNAVAILABLE' },
        },
        { upsert: true, new: true },
      );
      return ok(res, { ...pending.toObject(), accountNumber: `****${pending.accountNumber.slice(-4)}`, verificationData: undefined }, message);
    }
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
    const productStatus = String(business.razorpay?.productStatus || '').toLowerCase();
    if (
      normalized.isValid &&
      business.razorpay?.accountId &&
      business.razorpay?.productId &&
      ['requested', 'needs_clarification'].includes(productStatus)
    ) {
      try {
        const product = await updateRazorpayProductConfiguration(
          business.razorpay.accountId,
          business.razorpay.productId,
          settlementConfiguration(bank),
        );
        applyProviderProduct(business, product);
        business.razorpay.lastSyncedAt = new Date();
        await business.save();
      } catch (providerError) {
        console.error(
          '[razorpay-partner] settlement bank configuration deferred:',
          providerError.message,
        );
      }
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
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    if (!business?.razorpay?.accountId) {
      return fail(res, 'ONBOARDING_NOT_STARTED', 'Submit business onboarding details before requesting a QR.', 409);
    }
    return fail(res, 'PROVIDER_QR_PENDING', 'Your Razorpay business QR will appear after Razorpay activates the payment product. Please refresh verification status later.', 409);
  } catch (error) { next(error); }
});

export default router;
