import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middlewares/auth.js';
import MerchantPayment from '../models/MerchantPayment.js';
import MerchantLedger from '../models/MerchantLedger.js';
import MerchantSettlement from '../models/MerchantSettlement.js';
import { fail, ok } from '../utils/response.js';
import { verifyMerchantPayin } from '../services/velxapay/payinService.js';
import { creditMerchantCollection } from '../services/velxapay/webhookService.js';

const router = Router();
const balanceSummary = async (userId) => {
  const id = new mongoose.Types.ObjectId(userId);
  const [rows, settlements] = await Promise.all([
    MerchantLedger.aggregate([{ $match: { userId: id, type: 'COLLECTION_CREDIT' } }, { $group: { _id: '$status', amount: { $sum: '$amount' } } }]),
    MerchantSettlement.aggregate([{ $match: { userId: id } }, { $group: { _id: '$status', amount: { $sum: '$amount' } } }]),
  ]);
  const values = Object.fromEntries(rows.map((row) => [row._id, row.amount]));
  const payouts = Object.fromEntries(settlements.map((row) => [row._id, row.amount]));
  const reserved = (payouts.REQUESTED || 0) + (payouts.PROCESSING || 0) + (payouts.SETTLED || 0);
  return { available: Math.max(0, (values.AVAILABLE || 0) - reserved), pending: values.PENDING || 0, settled: payouts.SETTLED || 0 };
};
router.get('/summary', requireAuth, async (req, res, next) => {
  try { ok(res, await balanceSummary(req.user.uid)); } catch (error) { next(error); }
});
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const payments = await MerchantPayment.find({ merchantUserId: req.user.uid }).sort({ createdAt: -1 }).limit(200);
    ok(res, payments);
  } catch (error) { next(error); }
});
router.get('/:orderId/status', requireAuth, async (req, res, next) => {
  try {
    const payment = await MerchantPayment.findOne({ orderId: req.params.orderId, merchantUserId: req.user.uid });
    if (!payment) return fail(res, 'NOT_FOUND', 'Transaction not found.', 404);
    if (['PENDING', 'CREATED'].includes(payment.status)) {
      const provider = await verifyMerchantPayin(payment.orderId);
      const status = String(provider?.data?.payment_status || provider?.payment_status || '').toLowerCase();
      if (status === 'success') {
        const amount = provider?.data?.amount ?? provider?.data?.orderAmount ?? provider?.amount ?? payment.amount;
        await creditMerchantCollection({ orderId: payment.orderId, amount, utr: provider?.data?.utr ?? provider?.utr, provider: { verification: provider } });
      } else if (status === 'failed') { payment.status = 'FAILED'; payment.failedAt = new Date(); await payment.save(); }
    }
    ok(res, payment);
  } catch (error) { next(error); }
});
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const payment = await MerchantPayment.findOne({ _id: req.params.id, merchantUserId: req.user.uid });
    if (!payment) return fail(res, 'NOT_FOUND', 'Transaction not found.', 404);
    ok(res, payment);
  } catch (error) { next(error); }
});
export default router;
