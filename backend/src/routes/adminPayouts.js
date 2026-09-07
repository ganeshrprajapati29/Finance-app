import { Router } from 'express';
import Payout from '../models/Payout.js';
import VirtualAccount from '../models/VirtualAccount.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

// Get all payouts (paginated)
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = 'ALL' } = req.query;
    const query = status === 'ALL' ? {} : { status };

    const payouts = await Payout.find(query)
      .populate('userId', 'name email mobile')
      .populate('virtualAccountId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Payout.countDocuments(query);

    ok(res, { items: payouts, total });
  } catch (e) { next(e); }
});

// Create payout
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { userId, virtualAccountId, amount, description, bankDetails, accountDetails, mode = 'UPI', reference, notes } = req.body;

    const payoutAccountDetails = accountDetails || bankDetails;
    if (!userId || !amount || !payoutAccountDetails) {
      return fail(res, 'MISSING_FIELDS', 'Required fields: userId, amount, bankDetails/accountDetails', 400);
    }

    const virtualAccount = virtualAccountId
      ? await VirtualAccount.findById(virtualAccountId)
      : await VirtualAccount.findOne({ userId, isActive: true }).sort({ createdAt: -1 });

    const payout = new Payout({
      userId,
      virtualAccountId: virtualAccount?._id,
      razorpayPayoutId: `manual_pout_${Date.now()}`,
      amount,
      mode,
      description: description || 'Payout to user',
      accountDetails: payoutAccountDetails,
      reference,
      notes: notes || description,
      status: 'pending'
    });

    await payout.save();

    ok(res, payout, 'Payout created successfully');
  } catch (e) { next(e); }
});

// Get payout details
router.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const payout = await Payout.findById(req.params.id)
      .populate('userId', 'name email mobile')
      .populate('virtualAccountId');

    if (!payout) return fail(res, 'NOT_FOUND', 'Payout not found', 404);

    ok(res, payout);
  } catch (e) { next(e); }
});

// Update payout status
router.put('/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { status, txnId, failureReason } = req.body;

    const payout = await Payout.findById(req.params.id);
    if (!payout) return fail(res, 'NOT_FOUND', 'Payout not found', 404);

    payout.status = String(status || '').toLowerCase();
    if (txnId) payout.txnId = txnId;
    if (failureReason) payout.failureReason = failureReason;
    payout.processedAt = new Date();

    await payout.save();

    ok(res, payout, 'Payout status updated successfully');
  } catch (e) { next(e); }
});

// Delete payout (only if pending)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const payout = await Payout.findById(req.params.id);
    if (!payout) return fail(res, 'NOT_FOUND', 'Payout not found', 404);

    if (payout.status !== 'PENDING') {
      return fail(res, 'CANNOT_DELETE', 'Only pending payouts can be deleted', 400);
    }

    await Payout.findByIdAndDelete(req.params.id);

    ok(res, null, 'Payout deleted successfully');
  } catch (e) { next(e); }
});

export default router;
