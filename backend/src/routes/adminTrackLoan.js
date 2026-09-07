import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAdmin } from '../middlewares/adminAuth.js';
import Loan from '../models/Loan.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import { ok, fail } from '../utils/response.js';

const router = Router();
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.use(requireAdmin);

const loanPopulate = [
  { path: 'userId', select: 'name email mobile' },
  { path: 'decision.decidedBy', select: 'name email' }
];

// Search loan by account number, loan ID, user email, mobile, or name.
router.get('/search', async (req, res, next) => {
  try {
    const rawQuery = String(req.query.query || '').trim();

    if (!rawQuery) {
      return fail(res, 'MISSING_QUERY', 'Search query is required', 400);
    }

    const safeQuery = escapeRegex(rawQuery);
    const exactRegex = new RegExp(`^${safeQuery}$`, 'i');
    const looseRegex = new RegExp(safeQuery, 'i');
    let loan;

    if (mongoose.Types.ObjectId.isValid(rawQuery)) {
      loan = await Loan.findById(rawQuery).populate(loanPopulate);
    }

    if (!loan) {
      loan = await Loan.findOne({ loanAccountNumber: exactRegex }).populate(loanPopulate);
    }

    if (!loan) {
      const user = await User.findOne({
        $or: [
          { email: exactRegex },
          { mobile: exactRegex },
          { name: looseRegex }
        ]
      }).sort({ createdAt: -1 });

      if (user) {
        loan = await Loan.findOne({ userId: user._id })
          .populate(loanPopulate)
          .sort({ createdAt: -1 });
      }
    }

    if (!loan) {
      loan = await Loan.findOne({ loanAccountNumber: looseRegex })
        .populate(loanPopulate)
        .sort({ createdAt: -1 });
    }

    if (!loan) {
      return fail(res, 'NOT_FOUND', 'Loan not found. Please check loan account, email, mobile, name, or loan ID and try again.', 404);
    }

    const loanDetails = await calculateLoanDetails(loan);

    return ok(res, loanDetails);
  } catch (e) { next(e); }
});

// Get loan details by ID
router.get('/:loanId', async (req, res, next) => {
  try {
    const { loanId } = req.params;

    const loan = await Loan.findById(loanId)
      .populate(loanPopulate);

    if (!loan) {
      return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    }

    const loanDetails = await calculateLoanDetails(loan);

    return ok(res, loanDetails);
  } catch (e) { next(e); }
});

// Get loan payment history
router.get('/:loanId/payments', async (req, res, next) => {
  try {
    const { loanId } = req.params;

    const payments = await Payment.find({ loanId })
      .populate('userId', 'name email mobile')
      .sort({ createdAt: -1 });

    return ok(res, payments);
  } catch (e) { next(e); }
});

// Helper function to calculate loan details
async function calculateLoanDetails(loan) {
  const schedule = Array.isArray(loan.schedule) ? loan.schedule : [];
  // Calculate totals from schedule
  const totalPrincipal = schedule.reduce((sum, s) => sum + Number(s.principal || 0), 0);
  const totalInterest = schedule.reduce((sum, s) => sum + Number(s.interest || 0), 0);
  const totalAmount = schedule.reduce((sum, s) => sum + Number(s.total || 0), 0);

  // Calculate paid amounts
  const paidInstallments = schedule.filter(s => s.paid);
  const paidPrincipal = paidInstallments.reduce((sum, s) => sum + Number(s.principal || 0), 0);
  const paidInterest = paidInstallments.reduce((sum, s) => sum + Number(s.interest || 0), 0);
  const paidAmount = paidInstallments.reduce((sum, s) => sum + Number(s.total || 0), 0);

  // Calculate outstanding amounts
  const outstandingPrincipal = totalPrincipal - paidPrincipal;
  const outstandingInterest = totalInterest - paidInterest;
  const outstandingAmount = totalAmount - paidAmount;

  // Get overdue installments
  const now = new Date();
  const overdueInstallments = schedule.filter(s =>
    !s.paid && new Date(s.dueDate) < now
  );

  const totalOverdue = overdueInstallments.reduce((sum, s) => sum + Number(s.total || 0), 0);

  // Get next payment due
  const nextDueInstallment = schedule
    .filter(s => !s.paid && new Date(s.dueDate) >= now)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0] || null;

  // Get recent payments
  const recentPayments = await Payment.find({ loanId: loan._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('userId', 'name email mobile');

  return {
    _id: loan._id,
    loanAccountNumber: loan.loanAccountNumber,
    user: loan.userId,
    status: loan.status,
    application: loan.application,
    decision: loan.decision,
    disbursementDate: loan.disbursementDate,
    totals: {
      principal: totalPrincipal,
      interest: totalInterest,
      total: totalAmount
    },
    paid: {
      principal: paidPrincipal,
      interest: paidInterest,
      total: paidAmount
    },
    outstanding: {
      principal: outstandingPrincipal,
      interest: outstandingInterest,
      total: outstandingAmount
    },
    overdue: {
      count: overdueInstallments.length,
      amount: totalOverdue,
      installments: overdueInstallments
    },
    nextDue: nextDueInstallment,
    schedule,
    transactions: loan.transactions || [],
    recentPayments: recentPayments.map(payment => ({
      _id: payment._id,
      installmentNo: payment.installmentNo || payment.metadata?.installmentNo,
      amount: payment.amount,
      type: payment.type,
      method: payment.method,
      reference: payment.reference || payment.gateway?.paymentId || payment.gateway?.orderId,
      status: payment.status,
      createdAt: payment.createdAt,
      userId: payment.userId
    })),
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt
  };
}

export default router;
