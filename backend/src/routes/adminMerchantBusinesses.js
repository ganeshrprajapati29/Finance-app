import { Router } from 'express';
import { requireAdmin } from '../middlewares/adminAuth.js';
import MerchantBusiness from '../models/MerchantBusiness.js';
import MerchantKyc from '../models/MerchantKyc.js';
import MerchantBankAccount from '../models/MerchantBankAccount.js';
import MerchantQR from '../models/MerchantQR.js';
import MerchantPayment from '../models/MerchantPayment.js';
import MerchantSettlement from '../models/MerchantSettlement.js';
import { fail, ok } from '../utils/response.js';
import { notifyUserSmart } from '../services/smartNotifications.js';
import { fetchRazorpayProductConfiguration, fetchRazorpaySubMerchant, mapRazorpayAccountStatus, razorpayPartnerV1Request } from '../services/razorpayPartner.js';
import User from '../models/User.js';
import { buildOnboardingChecklist, submitProviderOnboarding } from '../services/merchantOnboarding.js';

const router = Router();

async function buildBusinessRow(business) {
  const [kyc, bank, qr, payments, settlements, paymentHistory, settlementHistory] = await Promise.all([
    MerchantKyc.findOne({ businessId: business._id }),
    MerchantBankAccount.findOne({ businessId: business._id }),
    MerchantQR.findOne({ businessId: business._id }),
    MerchantPayment.aggregate([
      { $match: { businessId: business._id } },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        successful: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
        collectedAmount: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0] } },
      } },
    ]),
    MerchantSettlement.aggregate([
      { $match: { businessId: business._id } },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        settledAmount: { $sum: { $cond: [{ $eq: ['$status', 'SETTLED'] }, '$amount', 0] } },
        pendingAmount: { $sum: { $cond: [{ $in: ['$status', ['REQUESTED', 'PROCESSING']] }, '$amount', 0] } },
      } },
    ]),
    MerchantPayment.find({ businessId: business._id })
      .sort({ createdAt: -1 })
      .limit(12)
      .select('orderId amount netAmount status customer checkoutUrl utr providerTransactionId createdAt creditedAt failedAt')
      .lean(),
    MerchantSettlement.find({ businessId: business._id })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean(),
  ]);
  const bankObject = bank?.toObject();
  if (bankObject?.accountNumber) {
    bankObject.accountNumberMasked = `****${String(bankObject.accountNumber).slice(-4)}`;
    delete bankObject.accountNumber;
  }
  const owner = await User.findById(business.userId?._id || business.userId).select('kyc.panVerified kyc.aadhaarVerified').lean();
  return {
    business,
    kyc,
    bank: bankObject || null,
    qr,
    onboarding: buildOnboardingChecklist({ business, bank, qr, user: owner }),
    payments: payments[0] || { total: 0, successful: 0, collectedAmount: 0 },
    settlements: settlements[0] || { total: 0, settledAmount: 0, pendingAmount: 0 },
    history: {
      payments: paymentHistory,
      settlements: settlementHistory,
    },
  };
}

router.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const businesses = await MerchantBusiness.find().select('-razorpay.oauthAccessToken -razorpay.oauthRefreshToken -razorpay.oauthStateHash -razorpay.oauthStateExpiresAt').populate('userId', 'name email mobile').sort({ createdAt: -1 });
    const rows = await Promise.all(businesses.map(buildBusinessRow));
    ok(res, rows);
  } catch (error) { next(error); }
});

// Sends (or re-sends) a submitted application to Razorpay. Used for applications
// that were queued while provider access was unavailable.
router.post('/:id/provider-onboard', requireAdmin, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findById(req.params.id);
    if (!business) return fail(res, 'NOT_FOUND', 'Business profile not found.', 404);
    if (!business.onboardingRequest) return fail(res, 'ONBOARDING_NOT_SUBMITTED', 'The owner has not submitted business details yet.', 409);
    if (business.razorpay?.productId) return fail(res, 'ONBOARDING_ALREADY_STARTED', 'This business is already with Razorpay. Use status sync instead.', 409);
    const user = await User.findById(business.userId).select('name email mobile kyc');
    const result = await submitProviderOnboarding(business, user);
    ok(res, { row: await buildBusinessRow(business), queued: result.queued, reason: result.reason || '' }, result.queued
      ? `Razorpay did not accept the application yet: ${result.reason || 'provider unavailable'}. It stays queued.`
      : 'Application submitted to Razorpay.');
  } catch (error) { next(error); }
});

router.post('/:id/provider-sync', requireAdmin, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findById(req.params.id);
    if (!business?.razorpay?.accountId) return fail(res, 'PROVIDER_ACCOUNT_REQUIRED', 'Razorpay onboarding has not started for this business.', 409);
    const account = await fetchRazorpaySubMerchant(business.razorpay.accountId);
    business.status = mapRazorpayAccountStatus(account.status);
    business.razorpay.accountStatus = account.status;
    business.razorpay.requirements = account.requirements || business.razorpay.requirements;
    if (business.razorpay.productId) {
      const product = await fetchRazorpayProductConfiguration(business.razorpay.accountId, business.razorpay.productId);
      business.razorpay.productStatus = product.status || business.razorpay.productStatus;
      business.razorpay.requirements = product.requirements || business.razorpay.requirements;
      business.razorpay.productConfiguration = product;
      if (product.status) business.status = mapRazorpayAccountStatus(product.status);
    }
    business.razorpay.lastSyncedAt = new Date();
    await business.save();
    ok(res, { row: await buildBusinessRow(business) }, 'Razorpay business status updated.');
  } catch (error) { next(error); }
});

router.post('/:id/bank-status', requireAdmin, async (req, res, next) => {
  try {
    const status = String(req.body?.status || '').toUpperCase();
    const note = String(req.body?.note || '').trim();
    if (!['REVIEW', 'VERIFIED'].includes(status)) {
      return fail(res, 'INVALID_BANK_STATUS', 'Bank status must be REVIEW or VERIFIED.', 400);
    }

    const business = await MerchantBusiness.findById(req.params.id);
    if (!business) return fail(res, 'NOT_FOUND', 'Business profile not found.', 404);

    const bank = await MerchantBankAccount.findOne({ businessId: business._id });
    if (!bank) {
      return fail(res, 'BANK_DETAILS_REQUIRED', 'Bank details are not available for this business yet.', 409);
    }

    const now = new Date();
    const existingData = bank.verificationData && typeof bank.verificationData === 'object' ? bank.verificationData : {};
    bank.status = status;
    bank.verifiedAt = status === 'VERIFIED' ? now : bank.verifiedAt;
    bank.verificationProvider = status === 'VERIFIED' ? 'KHATU_PAY_ADMIN' : (bank.verificationProvider || 'KHATU_PAY_REVIEW');
    bank.verificationMessage = note || (status === 'VERIFIED'
      ? 'Bank account marked verified by Khatu Pay.'
      : 'Bank account marked for Khatu Pay review.');
    bank.verificationData = {
      ...existingData,
      adminReview: {
        status,
        note,
        reviewedBy: req.admin?.id,
        reviewedAt: now,
      },
    };
    await bank.save();

    const row = await buildBusinessRow(business);
    return ok(res, { row }, status === 'VERIFIED'
      ? 'Bank marked VERIFIED. QR can now be activated.'
      : 'Bank marked REVIEW. QR can now be activated.');
  } catch (error) { next(error); }
});

router.post('/:id/qr-status', requireAdmin, async (req, res, next) => {
  try {
    const status = String(req.body?.status || '').toUpperCase();
    const note = String(req.body?.note || '').trim();
    if (!['ACTIVE', 'DISABLED'].includes(status)) {
      return fail(res, 'INVALID_QR_STATUS', 'QR status must be ACTIVE or DISABLED.', 400);
    }

    const business = await MerchantBusiness.findById(req.params.id);
    if (!business) return fail(res, 'NOT_FOUND', 'Business profile not found.', 404);

    let qr = await MerchantQR.findOne({ businessId: business._id });
    if (status === 'ACTIVE') {
      return fail(res, 'PROVIDER_QR_REQUIRED', 'Only Razorpay can activate a business QR after the payment product is approved.', 409);
    } else {
      if (!qr) return fail(res, 'QR_NOT_FOUND', 'Business QR has not been generated yet.', 404);
      if (qr.provider === 'RAZORPAY_PARTNER' && qr.providerQrId) {
        await razorpayPartnerV1Request(
          'post',
          `/v1/payments/qr_codes/${encodeURIComponent(qr.providerQrId)}/close`,
          undefined,
          { accountId: business.razorpay.accountId },
        );
      }
      qr.status = 'DISABLED';
      qr.disabledAt = new Date();
      qr.disabledReason = note || 'Disabled by Khatu Pay.';
      qr.statusHistory = [...(qr.statusHistory || []), {
        status: 'DISABLED',
        note: qr.disabledReason,
        actor: String(req.admin?.id || 'ADMIN'),
        at: new Date(),
      }].slice(-30);
      await qr.save();
    }

    const row = await buildBusinessRow(business);
    return ok(res, { row }, status === 'ACTIVE' ? 'Business QR enabled.' : 'Business QR disabled.');
  } catch (error) { next(error); }
});

router.post('/:id/decision', requireAdmin, async (req, res, next) => {
  try {
    const decision = String(req.body?.decision || '').toUpperCase();
    const business = await MerchantBusiness.findById(req.params.id);
    if (!business) return fail(res, 'NOT_FOUND', 'Business profile not found.', 404);
    if (decision === 'APPROVED') {
      return fail(res, 'PROVIDER_REVIEW_REQUIRED', 'Razorpay controls payment-product approval and QR activation. Use Razorpay status sync instead of local approval.', 409);
    } else if (decision === 'REJECTED') {
      const reason = String(req.body?.reason || '').trim();
      if (!reason) return fail(res, 'REASON_REQUIRED', 'Enter a customer-friendly rejection reason.', 400);
      business.status = 'REJECTED'; business.rejectionReason = reason; await business.save();
      notifyUserSmart(business.userId, 'business_qr_rejected', {
        email: true,
        force: true,
        businessName: business.businessName,
        reason,
        reference: business.publicId,
        route: '/business/verification',
        dedupeKey: `business-qr-rejected:${business._id}:${new Date().toISOString().slice(0, 10)}`,
        data: { businessId: String(business._id), publicId: business.publicId, status: business.status },
      }).catch((error) => console.error('Business QR rejection email failed:', error.message));
    } else return fail(res, 'INVALID_DECISION', 'Decision must be APPROVED or REJECTED.', 400);
    ok(res, { business }, `Business ${decision.toLowerCase()}.`);
  } catch (error) { next(error); }
});
export default router;
