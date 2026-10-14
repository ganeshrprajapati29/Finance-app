import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import MerchantBusiness from '../models/MerchantBusiness.js';
import MerchantQR from '../models/MerchantQR.js';
import MerchantPayment from '../models/MerchantPayment.js';
import MerchantLedger from '../models/MerchantLedger.js';
import { fail, ok } from '../utils/response.js';
import { isRazorpayConnected, razorpayRequestForBusiness } from '../services/razorpayPartner.js';

const router = Router();
router.get('/public/:merchantId', async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ publicId: req.params.merchantId, $or: [{ 'razorpay.productStatus': 'activated' }, { 'razorpay.oauthConnectedAt': { $ne: null } }] }).select('publicId businessName category status razorpay.productStatus');
    if (!business) return fail(res, 'MERCHANT_UNAVAILABLE', 'This merchant is not accepting payments right now.', 404);
    const qr = await MerchantQR.findOne({ businessId: business._id });
    if (qr?.status === 'DISABLED') return fail(res, 'MERCHANT_QR_DISABLED', 'This merchant QR is not accepting payments right now.', 404);
    ok(res, { ...business.toObject(), qrStatus: qr?.status || 'NOT_GENERATED' });
  } catch (error) { next(error); }
});
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    if (!business) return fail(res, 'PROFILE_REQUIRED', 'Create your business profile first.', 409);
    if (['REJECTED', 'SUSPENDED'].includes(business.status)) return fail(res, 'BUSINESS_ON_HOLD', 'Your business is on hold. Please contact KhatuPay support.', 409);
    const activated = business.razorpay?.accountId && String(business.razorpay.productStatus || '').toLowerCase() === 'activated';
    if (!isRazorpayConnected(business) && !activated) return fail(res, 'PRODUCT_NOT_ACTIVE', 'Connect your Razorpay account before creating a QR.', 409);
    const existing = await MerchantQR.findOne({ businessId: business._id, provider: 'RAZORPAY_PARTNER', status: 'ACTIVE' });
    if (existing) return ok(res, existing, 'Business QR is already active.');
    const providerQr = await razorpayRequestForBusiness(business, 'post', '/v1/payments/qr_codes', {
      type: 'upi_qr', name: business.businessName, usage: 'multiple_use', fixed_amount: false,
      description: `KhatuPay business QR ${business.publicId}`, notes: { khatupay_business_id: business.publicId },
    });
    const qr = await MerchantQR.findOneAndUpdate({ businessId: business._id }, {
      userId: business.userId, qrReference: providerQr.id, providerQrId: providerQr.id,
      payload: providerQr.image_url || providerQr.id, paymentUrl: providerQr.image_url,
      qrImageDataUrl: providerQr.image_url, provider: 'RAZORPAY_PARTNER', collectionMode: 'RAZORPAY_QR', status: 'ACTIVE',
      statusHistory: [{ status: 'ACTIVE', note: 'Created by Razorpay after merchant authorisation.', actor: 'RAZORPAY', at: new Date() }],
    }, { upsert: true, new: true });
    return ok(res, qr, 'Business QR created successfully.');
  } catch (error) { next(error); }
});

router.post('/sync-payments', requireAuth, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    const qr = await MerchantQR.findOne({ businessId: business?._id, provider: 'RAZORPAY_PARTNER' });
    if (!business || !qr?.providerQrId) return fail(res, 'QR_NOT_READY', 'Create a Razorpay business QR first.', 409);
    const data = await razorpayRequestForBusiness(
      business,
      'get',
      `/v1/payments/qr_codes/${encodeURIComponent(qr.providerQrId)}/payments?count=100`,
    );
    for (const item of data.items || []) {
      const status = String(item.status || '').toLowerCase() === 'captured' ? 'SUCCESS' : String(item.status || '').toLowerCase() === 'refunded' ? 'REFUNDED' : String(item.status || '').toLowerCase() === 'failed' ? 'FAILED' : 'PENDING';
      const payment = await MerchantPayment.findOneAndUpdate({ orderId: item.id }, { businessId: business._id, merchantUserId: business.userId, orderId: item.id, amount: Number(item.amount || 0) / 100, currency: item.currency || 'INR', status, utr: item.acquirer_data?.rrn || item.acquirer_data?.upi_transaction_id, providerTransactionId: item.id, provider: { razorpay: item }, ...(status === 'SUCCESS' ? { creditedAt: new Date() } : {}) }, { upsert: true, new: true });
      if (status === 'SUCCESS') await MerchantLedger.findOneAndUpdate(
        { idempotencyKey: `razorpay:payment:${item.id}:credit` },
        { $setOnInsert: { businessId: business._id, userId: business.userId, paymentId: payment._id, idempotencyKey: `razorpay:payment:${item.id}:credit`, type: 'COLLECTION_CREDIT', amount: Number(item.amount || 0) / 100, status: 'AVAILABLE', availableOn: new Date(), description: 'Razorpay QR collection' } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
    ok(res, { synced: (data.items || []).length }, 'QR payment history updated.');
  } catch (error) { next(error); }
});
router.post('/close', requireAuth, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    const qr = await MerchantQR.findOne({ businessId: business?._id, provider: 'RAZORPAY_PARTNER', status: 'ACTIVE' });
    if (!qr?.providerQrId) return fail(res, 'QR_NOT_READY', 'No active Razorpay business QR is available.', 409);
    // Razorpay does not permit closing a multiple-use QR. Keeping the local
    // state active prevents the app from falsely claiming that collections
    // have stopped while the provider QR can still accept payments.
    return fail(res, 'MULTIPLE_USE_QR_CANNOT_CLOSE', 'This active business QR accepts multiple payments and cannot be closed by the provider. Contact support to replace the QR safely.', 409);
  } catch (error) { next(error); }
});
router.get('/me', requireAuth, async (req, res, next) => {
  try { ok(res, await MerchantQR.findOne({ userId: req.user.uid })); } catch (error) { next(error); }
});
router.post('/payment-order', async (req, res, next) => {
  try {
    await Joi.object({
      merchantId: Joi.string().required(), amount: Joi.number().positive().max(200000).precision(2).required(),
      firstName: Joi.string().min(1).required(), lastName: Joi.string().allow(''),
      email: Joi.string().email().required(), phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
    }).validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    return fail(res, 'PROVIDER_COLLECTION_PENDING', 'Merchant collections are available only after Razorpay activates the QR product. Please try again later.', 409);
  } catch (error) { next(error); }
});
export default router;
