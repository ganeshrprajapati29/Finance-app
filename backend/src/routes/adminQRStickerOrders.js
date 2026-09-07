import { Router } from 'express';
import Joi from 'joi';
import QRStickerOrder from '../models/QRStickerOrder.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = 'ALL', paymentStatus = 'ALL', search = '' } = req.query;
    const query = {};
    if (status !== 'ALL') query.orderStatus = status;
    if (paymentStatus !== 'ALL') query.paymentStatus = paymentStatus;
    if (search) {
      query.$or = [
        { orderNo: { $regex: search, $options: 'i' } },
        { 'shippingAddress.name': { $regex: search, $options: 'i' } },
        { 'shippingAddress.mobile': { $regex: search, $options: 'i' } },
        { 'shippingAddress.pincode': { $regex: search, $options: 'i' } },
        { 'tracking.trackingNumber': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total, summary] = await Promise.all([
      QRStickerOrder.find(query)
        .populate('userId', 'name email mobile')
        .populate('qrCodeId')
        .populate('paymentId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      QRStickerOrder.countDocuments(query),
      QRStickerOrder.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            stickers: { $sum: '$quantity' },
            revenue: { $sum: '$totalAmount' },
            paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, '$totalAmount', 0] } }
          }
        }
      ])
    ]);

    ok(res, { items, total, summary: summary[0] || { orders: 0, stickers: 0, revenue: 0, paid: 0 } });
  } catch (e) { next(e); }
});

router.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const order = await QRStickerOrder.findById(req.params.id)
      .populate('userId', 'name email mobile')
      .populate('qrCodeId')
      .populate('paymentId');
    if (!order) return fail(res, 'NOT_FOUND', 'Sticker order not found', 404);
    ok(res, order);
  } catch (e) { next(e); }
});

router.put('/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const body = await Joi.object({
      orderStatus: Joi.string().valid('PLACED', 'PAYMENT_PENDING', 'CONFIRMED', 'PRINTING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED').required(),
      paymentStatus: Joi.string().valid('FREE', 'PENDING', 'PAID', 'FAILED', 'REFUNDED').optional(),
      courierName: Joi.string().allow('', null),
      trackingNumber: Joi.string().allow('', null),
      trackingUrl: Joi.string().allow('', null),
      adminNote: Joi.string().allow('', null)
    }).validateAsync(req.body);

    const order = await QRStickerOrder.findById(req.params.id);
    if (!order) return fail(res, 'NOT_FOUND', 'Sticker order not found', 404);

    order.orderStatus = body.orderStatus;
    if (body.paymentStatus) order.paymentStatus = body.paymentStatus;
    if (body.adminNote !== undefined) order.adminNote = body.adminNote || '';
    order.tracking = {
      ...(order.tracking || {}),
      courierName: body.courierName ?? order.tracking?.courierName,
      trackingNumber: body.trackingNumber ?? order.tracking?.trackingNumber,
      trackingUrl: body.trackingUrl ?? order.tracking?.trackingUrl
    };
    if (body.orderStatus === 'SHIPPED' && !order.tracking.shippedAt) order.tracking.shippedAt = new Date();
    if (body.orderStatus === 'DELIVERED' && !order.tracking.deliveredAt) order.tracking.deliveredAt = new Date();
    await order.save();

    await order.populate('userId', 'name email mobile');
    ok(res, order, 'Sticker order updated');
  } catch (e) { next(e); }
});

export default router;
