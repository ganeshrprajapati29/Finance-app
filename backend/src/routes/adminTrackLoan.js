import { Router } from 'express';
import Joi from 'joi';
import { requireAdmin } from '../middlewares/adminAuth.js';
import Loan from '../models/Loan.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

router.use(requireAdmin);

// Search loan by account number or email
router.get('/search', async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query) {
      return fail(res, 'MISSING_QUERY', 'Search query is required', 400);
    }

    let loan;

    // First try to find by loan account number (exact match)
    loan = await Loan.findOne({ loanAccountNumber: query.trim() })
      .populate('userId', 'name email mobile')
      .populate('decision.decidedBy', 'name');

    // If not found, try to find by user email (case-insensitive)
    if (!loan) {
      const user = await User.findOne({ email: { $regex: new RegExp(`^${query.trim()}$`, 'i') } });
      if (user) {
        // Find the most recent loan for this user
        loan = await Loan.findOne({ userId: user._id })
          .populate('userId', 'name email mobile')
          .populate('decision.decidedBy', 'name')
          .sort({ createdAt: -1 }); // Get most recent loan
      }
    }

    // If still not found, try to find by partial loan account number
    if (!loan) {
      loan = await Loan.findOne({ loanAccountNumber: { $regex: new RegExp(query.trim(), 'i') } })
        .populate('userId', 'name email mobile')
        .populate('decision.decidedBy', 'name')
        .sort({ createdAt: -1 });
    }

    if (!loan) {
      return fail(res, 'NOT_FOUND', 'Loan not found. Please check the account number or email and try again.', 404);
    }

    // Calculate loan details
    const loanDetails = await calculateLoanDetails(loan);

    return ok(res, loanDetails);
  } catch (e) { next(e); }
});

// Get loan details by ID
router.get('/:loanId', async (req, res, next) => {
  try {
    const { loanId } = req.params;

    const loan = await Loan.findById(loanId)
      .populate('userId', 'name email mobile')
      .populate('decision.decidedBy', 'name');

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
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    return ok(res, payments);
  } catch (e) { next(e); }
});

// Helper function to calculate loan details
async function calculateLoanDetails(loan) {
  // Calculate totals from schedule
  const totalPrincipal = loan.schedule.reduce((sum, s) => sum + s.principal, 0);
  const totalInterest = loan.schedule.reduce((sum, s) => sum + s.interest, 0);
  const totalAmount = loan.schedule.reduce((sum, s) => sum + s.total, 0);

  // Calculate paid amounts
  const paidPrincipal = loan.schedule.filter(s => s.paid).reduce((sum, s) => sum + s.principal, 0);
  const paidInterest = loan.schedule.filter(s => s.paid).reduce((sum, s) => sum + s.interest, 0);
  const paidAmount = loan.schedule.filter(s => s.paid).reduce((sum, s) => sum + s.total, 0);

  // Calculate outstanding amounts
  const outstandingPrincipal = totalPrincipal - paidPrincipal;
  const outstandingInterest = totalInterest - paidInterest;
  const outstandingAmount = totalAmount - paidAmount;

  // Get overdue installments
  const now = new Date();
  const overdueInstallments = loan.schedule.filter(s =>
    !s.paid && new Date(s.dueDate) < now
  );

  const totalOverdue = overdueInstallments.reduce((sum, s) => sum + s.total, 0);

  // Get next payment due
  const nextDueInstallment = loan.schedule.find(s =>
    !s.paid && new Date(s.dueDate) >= now
  );

  // Get recent payments
  const recentPayments = await Payment.find({ loanId: loan._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('userId', 'name');

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
    schedule: loan.schedule,
    transactions: loan.transactions,
    recentPayments: recentPayments.map(payment => ({
      _id: payment._id,
      amount: payment.amount,
      status: payment.status,
      createdAt: payment.createdAt,
      userId: payment.userId
    })),
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt
  };
}

export default router;
