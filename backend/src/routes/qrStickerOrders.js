import { Router } from 'express';
import Joi from 'joi';
import QRCodeModel from '../models/QRCode.js';
import QRStickerOrder from '../models/QRStickerOrder.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import { getRazorpay } from '../services/razorpay.js';

const router = Router();

const FREE_STICKER_LIMIT = Number(process.env.QR_STICKER_FREE_LIMIT || 2);
const STICKER_PRICES = {
  STANDARD: Number(process.env.QR_STICKER_STANDARD_PRICE || 49),
  PREMIUM: Number(process.env.QR_STICKER_PREMIUM_PRICE || 99),
  SHOP_BOARD: Number(process.env.QR_STICKER_SHOP_BOARD_PRICE || 249)
};
const DELIVERY_CHARGE = Number(process.env.QR_STICKER_DELIVERY_CHARGE || 0);

function calculatePricing(type, quantity, alreadyFreeUsed) {
  const freeAvailable = Math.max(0, FREE_STICKER_LIMIT - alreadyFreeUsed);
  const freeQuantity = Math.min(quantity, freeAvailable);
  const chargeableQuantity = Math.max(0, quantity - freeQuantity);
  const unitPrice = STICKER_PRICES[type] ?? STICKER_PRICES.STANDARD;
  const subtotal = chargeableQuantity * unitPrice;
  const deliveryCharge = subtotal > 0 ? DELIVERY_CHARGE : 0;
  return {
    freeQuantity,
    chargeableQuantity,
    unitPrice,
    deliveryCharge,
    subtotal,
    totalAmount: subtotal + deliveryCharge
  };
}

router.get('/config', requireAuth, async (req, res, next) => {
  try {
    const used = await QRStickerOrder.aggregate([
      { $match: { userId: req.user.uid, orderStatus: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, total: { $sum: '$freeQuantity' } } }
    ]);
    ok(res, {
      freeLimit: FREE_STICKER_LIMIT,
      freeUsed: used[0]?.total || 0,
      freeRemaining: Math.max(0, FREE_STICKER_LIMIT - (used[0]?.total || 0)),
      prices: STICKER_PRICES,
      deliveryCharge: DELIVERY_CHARGE
    });
  } catch (e) { next(e); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = await Joi.object({
      qrCodeId: Joi.string().allow('', null),
      stickerType: Joi.string().valid('STANDARD', 'PREMIUM', 'SHOP_BOARD').default('STANDARD'),
      quantity: Joi.number().integer().min(1).max(100).required(),
      shippingAddress: Joi.object({
        name: Joi.string().trim().required(),
        mobile: Joi.string().trim().required(),
        line1: Joi.string().trim().required(),
        line2: Joi.string().allow('', null),
        city: Joi.string().trim().required(),
        state: Joi.string().trim().required(),
        pincode: Joi.string().trim().required(),
        landmark: Joi.string().allow('', null)
      }).required(),
      userNote: Joi.string().allow('', null)
    }).validateAsync(req.body);

    let qr = null;
    if (body.qrCodeId) {
      qr = await QRCodeModel.findOne({ _id: body.qrCodeId, userId: req.user.uid });
      if (!qr) return fail(res, 'QR_NOT_FOUND', 'Selected QR code not found', 404);
    } else {
      qr = await QRCodeModel.findOne({ userId: req.user.uid, isActive: true }).sort({ createdAt: -1 });
    }
    if (!qr) return fail(res, 'NO_QR', 'Please generate a QR code before ordering stickers', 400);

    const used = await QRStickerOrder.aggregate([
      { $match: { userId: req.user.uid, orderStatus: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, total: { $sum: '$freeQuantity' } } }
    ]);
    const pricing = calculatePricing(body.stickerType, body.quantity, used[0]?.total || 0);

    const order = await QRStickerOrder.create({
      userId: req.user.uid,
      qrCodeId: qr._id,
      qrImagePath: qr.imagePath,
      qrPayload: qr.payload,
      stickerType: body.stickerType,
      quantity: body.quantity,
      ...pricing,
      shippingAddress: body.shippingAddress,
      userNote: body.userNote || '',
      paymentStatus: pricing.totalAmount > 0 ? 'PENDING' : 'FREE',
      orderStatus: pricing.totalAmount > 0 ? 'PAYMENT_PENDING' : 'CONFIRMED'
    });

    let checkout = null;
    if (pricing.totalAmount > 0) {
      const user = await User.findById(req.user.uid).select('name email mobile phone');
      const payment = new Payment({
        userId: req.user.uid,
        type: 'FEE',
        amount: pricing.totalAmount,
        method: 'RAZORPAY',
        reference: `KP-STICKER-${Date.now()}`,
        status: 'PENDING',
        gateway: { provider: 'razorpay' },
        metadata: { notes: 'QR sticker order', stickerOrderId: order._id, paymentDate: new Date() }
      });
      await payment.validate();
      let razorpayOrder;
      try {
        const rz = getRazorpay();
        razorpayOrder = await rz.orders.create({
          amount: Math.round(pricing.totalAmount * 100),
          currency: 'INR',
          receipt: `KP-STICKER-${Date.now()}`,
          notes: {
            purpose: 'qr_sticker_order',
            paymentId: String(payment._id),
            khatuPaymentId: payment.khatuPaymentId,
            type: 'FEE',
            stickerOrderId: String(order._id),
            orderNo: order.orderNo
          }
        });
      } catch (gatewayError) {
        const gatewayMessage =
          gatewayError.response?.data?.message ||
          gatewayError.response?.data?.error ||
          gatewayError.message ||
          'Payment gateway could not start the payment.';
        return fail(res, 'PAYMENT_GATEWAY_ERROR', gatewayMessage, 400);
      }
      payment.reference = razorpayOrder.id;
      payment.gateway = {
        provider: 'razorpay',
        orderId: razorpayOrder.id
      };
      payment.metadata = {
        ...(payment.metadata?.toObject?.() || payment.metadata || {}),
        razorpay: { orderId: razorpayOrder.id, customerMobile: user?.mobile || user?.phone || body.shippingAddress.mobile || '' }
      };
      await payment.save();
      order.paymentId = payment._id;
      order.razorpayOrderId = razorpayOrder.id;
      await order.save();
      checkout = {
        order: razorpayOrder,
        paymentId: payment._id,
        key_id: process.env.RAZORPAY_KEY_ID,
        gateway: 'razorpay'
      };
    }

    ok(res.status(201), { order, checkout }, 'QR sticker order created');
  } catch (e) { next(e); }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const orders = await QRStickerOrder.find({ userId: req.user.uid })
      .populate('qrCodeId')
      .sort({ createdAt: -1 })
      .limit(100);
    ok(res, orders);
  } catch (e) { next(e); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const order = await QRStickerOrder.findOne({ _id: req.params.id, userId: req.user.uid }).populate('qrCodeId paymentId');
    if (!order) return fail(res, 'NOT_FOUND', 'Sticker order not found', 404);
    ok(res, order);
  } catch (e) { next(e); }
});

router.put('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const order = await QRStickerOrder.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!order) return fail(res, 'NOT_FOUND', 'Sticker order not found', 404);
    if (!['PAYMENT_PENDING', 'PLACED', 'CONFIRMED'].includes(order.orderStatus)) {
      return fail(res, 'CANNOT_CANCEL', 'Order cannot be cancelled after printing starts', 400);
    }
    order.orderStatus = 'CANCELLED';
    await order.save();
    ok(res, order, 'Order cancelled');
  } catch (e) { next(e); }
});

export default router;
