import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import MerchantBusiness from '../models/MerchantBusiness.js';
import MerchantQR from '../models/MerchantQR.js';
import MerchantPayment from '../models/MerchantPayment.js';
import { created, fail, ok } from '../utils/response.js';
import { initiateMerchantPayin, makeMerchantOrderId } from '../services/velxapay/payinService.js';
import { activateMerchantQr } from '../utils/merchantQr.js';

const router = Router();
router.get('/public/:merchantId', async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ publicId: req.params.merchantId, status: 'APPROVED' }).select('publicId businessName category status');
    if (!business) return fail(res, 'MERCHANT_UNAVAILABLE', 'This merchant is not accepting payments right now.', 404);
    const qr = await MerchantQR.findOne({ businessId: business._id });
    if (qr?.status === 'DISABLED') return fail(res, 'MERCHANT_QR_DISABLED', 'This merchant QR is not accepting payments right now.', 404);
    ok(res, { ...business.toObject(), qrStatus: qr?.status || 'NOT_GENERATED' });
  } catch (error) { next(error); }
});
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ userId: req.user.uid, status: 'APPROVED' });
    if (!business) return fail(res, 'APPROVAL_REQUIRED', 'Business approval is required before generating a QR.', 409);
    const qr = await activateMerchantQr(business, req.user.uid);
    ok(res, qr);
  } catch (error) { next(error); }
});
router.get('/me', requireAuth, async (req, res, next) => {
  try { ok(res, await MerchantQR.findOne({ userId: req.user.uid })); } catch (error) { next(error); }
});
router.post('/payment-order', async (req, res, next) => {
  try {
    const payload = await Joi.object({
      merchantId: Joi.string().required(), amount: Joi.number().positive().max(200000).precision(2).required(),
      firstName: Joi.string().min(1).required(), lastName: Joi.string().allow(''),
      email: Joi.string().email().required(), phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
    }).validateAsync(req.body, { abortEarly: false, stripUnknown: true });
    const business = await MerchantBusiness.findOne({ publicId: payload.merchantId, status: 'APPROVED' });
    if (!business) return fail(res, 'MERCHANT_UNAVAILABLE', 'This merchant is not accepting payments right now.', 404);
    const qr = await MerchantQR.findOne({ businessId: business._id });
    if (qr?.status === 'DISABLED') return fail(res, 'MERCHANT_QR_DISABLED', 'This merchant QR is not accepting payments right now.', 409);
    const orderId = makeMerchantOrderId();
    const payment = await MerchantPayment.create({ businessId: business._id, merchantUserId: business.userId, orderId, amount: payload.amount, customer: payload, status: 'CREATED' });
    try {
      const result = await initiateMerchantPayin({ orderId, ...payload });
      payment.checkoutUrl = result.checkoutUrl; payment.provider = result.provider; payment.status = 'PENDING'; await payment.save();
      created(res, { orderId, checkoutUrl: result.checkoutUrl, status: payment.status, merchant: { name: business.businessName, id: business.publicId } }, 'Payment order created.');
    } catch (error) { payment.status = 'FAILED'; payment.failedAt = new Date(); payment.provider = { error: error.code }; await payment.save(); throw error; }
  } catch (error) { next(error); }
});
export default router;
