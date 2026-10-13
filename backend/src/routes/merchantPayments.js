import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middlewares/auth.js';
import MerchantPayment from '../models/MerchantPayment.js';
import MerchantLedger from '../models/MerchantLedger.js';
import MerchantSettlement from '../models/MerchantSettlement.js';
import { fail, ok } from '../utils/response.js';

const router = Router();
const balanceSummary = async (userId) => {
  const id = new mongoose.Types.ObjectId(userId);
  const [payments, settlements] = await Promise.all([
    MerchantPayment.aggregate([
      { $match: { merchantUserId: id } },
      {
        $group: {
          _id: null,
          collected: {
            $sum: {
              $cond: [{ $in: ['$status', ['SUCCESS', 'REFUNDED']] }, '$amount', 0],
            },
          },
          refunded: { $sum: { $ifNull: ['$refundedAmount', 0] } },
          pending: {
            $sum: {
              $cond: [{ $in: ['$status', ['CREATED', 'PENDING']] }, '$amount', 0],
            },
          },
        },
      },
    ]),
    MerchantSettlement.aggregate([{ $match: { userId: id } }, { $group: { _id: '$status', amount: { $sum: '$amount' } } }]),
  ]);
  const totals = payments[0] || { collected: 0, refunded: 0, pending: 0 };
  const payouts = Object.fromEntries(settlements.map((row) => [row._id, row.amount]));
  const settled = Number(payouts.SETTLED || 0);
  const inProgress = Number(payouts.REQUESTED || 0) + Number(payouts.PROCESSING || 0);
  const collected = Math.max(0, Number(totals.collected || 0) - Number(totals.refunded || 0));
  return {
    collected,
    available: Math.max(0, collected - settled - inProgress),
    pending: Number(totals.pending || 0),
    settlementInProgress: inProgress,
    settled,
  };
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
