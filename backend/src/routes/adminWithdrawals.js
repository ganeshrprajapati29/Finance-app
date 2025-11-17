import { Router } from 'express';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import User from '../models/User.js';
import Loan from '../models/Loan.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

// Get all withdrawal requests
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { status = 'ALL', page = 1, limit = 20 } = req.query;
    const query = status === 'ALL' ? {} : { status };
    const withdrawals = await WithdrawalRequest.find(query)
      .populate('userId', 'name email mobile loanLimit walletBalance')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await WithdrawalRequest.countDocuments(query);

    // Add cache control headers to prevent caching
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    ok(res, { items: withdrawals, total, data: withdrawals });
  } catch (e) { next(e); }
});

// Approve/Reject withdrawal
router.post('/:id/decision', requireAdmin, async (req, res, next) => {
  try {
    const { decision, txnId, notes } = req.body;
    const withdrawal = await WithdrawalRequest.findById(req.params.id);
    if (!withdrawal) return fail(res, 'NOT_FOUND', 'Withdrawal request not found', 404);

    if (decision === 'APPROVED') {
      withdrawal.status = 'APPROVED';
      withdrawal.decidedAt = new Date();
      withdrawal.decidedBy = req.admin.uid;
      withdrawal.txnId = txnId;
      withdrawal.notes = notes;

      // Deduct from wallet balance
      const user = await User.findById(withdrawal.userId);
      if (user) {
        user.walletBalance = (user.walletBalance || 0) - withdrawal.amount;
        await user.save();
      }

      // Add transaction to loan (find active loan or create one)
      const loan = await Loan.findOne({ userId: withdrawal.userId, status: { $in: ['DISBURSED', 'CLOSED'] } }).sort({ createdAt: -1 });
      if (loan) {
        const txn = {
          type: 'WITHDRAWAL',
          amount: withdrawal.amount,
          bankName: withdrawal.bankDetails.bankName,
          accountNumber: withdrawal.bankDetails.accountNumber,
          ifscCode: withdrawal.bankDetails.ifscCode,
          accountHolderName: withdrawal.bankDetails.accountHolderName,
          txnId: txnId,
          status: 'COMPLETED',
          timestamp: new Date()
        };
        if (!loan.transactions) loan.transactions = [];
        loan.transactions.push(txn);
        await loan.save();
      }
    } else if (decision === 'REJECTED') {
      withdrawal.status = 'REJECTED';
      withdrawal.decidedAt = new Date();
      withdrawal.decidedBy = req.admin.uid;
      withdrawal.notes = notes;
    } else {
      return fail(res, 'INVALID', 'Invalid decision');
    }

    await withdrawal.save();
    ok(res, withdrawal, `Withdrawal ${decision.toLowerCase()} successfully`);
  } catch (e) { next(e); }
});

export default router;
