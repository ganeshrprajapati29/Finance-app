import { Router } from 'express';
import Loan from '../models/Loan.js';
import Notification from '../models/Notification.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';
import { quickSort, mergeSort, PriorityQueue } from '../utils/dsa.js';
import { notifyUserSmart } from '../services/smartNotifications.js';
import LoanVerification from '../models/LoanVerification.js';

const REQUIRED_SIGNCARE_STAGES = ['pan', 'aadhaar', 'liveness', 'faceMatch', 'bank', 'credit'];

const router = Router();

// 🟢 Get all loan applications (paginated) with DSA optimizations
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { status = 'ALL', page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const query = status === 'ALL' ? {} : { status };

    // Use database sorting for initial fetch, but prepare for client-side DSA sorting if needed
    let sortCriteria = {};
    sortCriteria[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const loans = await Loan.find(query)
      .populate('userId', 'name email mobile')
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Loan.countDocuments(query);
    const userIds = loans.map((loan) => loan.userId?._id || loan.userId).filter(Boolean);
    const verificationRows = await LoanVerification.find({ userId: { $in: userIds } }).lean();
    const verificationByUser = new Map(verificationRows.map((row) => [String(row.userId), row]));
    const loansWithVerification = loans.map((loan) => {
      const item = loan.toObject();
      item.signcareVerification = verificationByUser.get(String(item.userId?._id || item.userId)) || null;
      return item;
    });

    // If loans need custom sorting (e.g., by due dates), use DSA algorithms
    if (sortBy === 'nextDueDate' && loans.length > 0) {
      const compareFn = (a, b) => {
        const aDue = a.schedule?.find(s => !s.paid)?.dueDate?.getTime() || Infinity;
        const bDue = b.schedule?.find(s => !s.paid)?.dueDate?.getTime() || Infinity;
        return sortOrder === 'desc' ? bDue - aDue : aDue - bDue;
      };
      const sortedLoans = quickSort(loansWithVerification, compareFn);
      ok(res, { items: sortedLoans, total });
    } else {
      ok(res, { items: loansWithVerification, total });
    }
  } catch (e) {
    next(e);
  }
});

// 🟡 Approve / Reject Loan
router.post('/:id/decision', requireAdmin, async (req, res, next) => {
  try {
    const {
      decision, amountApproved, rateAPR, tenureMonths, rejectionReason,
      processingFee = 0, taxAmount = 0, lenderName = '', kfsUrl = '', agreementUrl = ''
    } = req.body;
    const loan = await Loan.findById(req.params.id);
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    if (!['PENDING', 'UNDER_REVIEW', 'DOCUMENTS_REQUIRED'].includes(loan.status)) {
      return fail(res, 'INVALID_STATE', 'This application has already been decided.', 409);
    }

    if (decision === 'APPROVED') {
      const verification = await LoanVerification.findOne({ userId: loan.userId }).lean();
      const incomplete = REQUIRED_SIGNCARE_STAGES.filter((stage) => verification?.[stage]?.status !== 'VERIFIED');
      if (incomplete.length) {
        return fail(
          res,
          'VERIFICATION_INCOMPLETE',
          `Complete SignCare verification before approval: ${incomplete.join(', ')}.`,
          409,
          { incompleteStages: incomplete }
        );
      }
      const approved = Number(amountApproved);
      const apr = Number(rateAPR);
      const tenure = Number(tenureMonths);
      if (!(approved > 0) || apr < 0 || !(tenure > 0)) {
        return fail(res, 'INVALID_OFFER', 'Enter a valid approved amount, APR and tenure.', 400);
      }
      const fees = Math.max(0, Number(processingFee || 0));
      const taxes = Math.max(0, Number(taxAmount || 0));
      loan.status = 'APPROVED';
      loan.decision = {
        amountApproved: approved,
        rateAPR: apr,
        tenureMonths: tenure,
        processingFee: fees,
        taxAmount: taxes,
        netDisbursalAmount: Math.max(0, approved - fees - taxes),
        lenderName: String(lenderName || '').trim(),
        kfsUrl: String(kfsUrl || '').trim(),
        agreementUrl: String(agreementUrl || '').trim(),
        decidedAt: new Date(),
        decidedBy: req.admin.id,
      };
      loan.statusHistory.push({
        status: 'APPROVED', title: 'Loan approved',
        message: 'Your loan offer is ready for review.', actorType: 'ADMIN', actorId: req.admin.id
      });

      // Create notification for user about loan approval
      await Notification.create({
        userId: loan.userId,
        title: 'Loan Application Approved',
        message: `Congratulations! Your loan application for ₹${amountApproved} has been approved.`,
        type: 'loan',
        priority: 'HIGH',
        data: {
          loanId: loan._id,
          amountApproved,
          rateAPR,
          tenureMonths
        }
      });
    } else if (decision === 'REJECTED') {
      if (!String(rejectionReason || '').trim()) {
        return fail(res, 'REASON_REQUIRED', 'A customer-friendly rejection reason is required.', 400);
      }
      loan.status = 'REJECTED';
      loan.decision = {
        rejectionReason: String(rejectionReason).trim(),
        decidedAt: new Date(),
        decidedBy: req.admin.id,
      };
      loan.statusHistory.push({
        status: 'REJECTED', title: 'Application not approved',
        message: 'The application did not meet the current eligibility criteria.',
        reason: String(rejectionReason).trim(), actorType: 'ADMIN', actorId: req.admin.id
      });

      // Create notification for user about loan rejection
      await Notification.create({
        userId: loan.userId,
        title: 'Loan Application Rejected',
        message: 'We regret to inform you that your loan application has been rejected.',
        type: 'loan',
        priority: 'MEDIUM',
        data: {
          loanId: loan._id
        }
      });
    } else {
      return fail(res, 'INVALID', 'Invalid decision');
    }

    await loan.save();
    if (decision === 'APPROVED') {
      await notifyUserSmart(loan.userId, 'loan_approved', {
        persist: false,
        loanId: loan._id,
        loanAccountNumber: loan.loanAccountNumber,
        amount: amountApproved,
        data: {
          loanId: String(loan._id),
          amountApproved,
          rateAPR,
          tenureMonths,
        },
      });
    } else if (decision === 'REJECTED') {
      await notifyUserSmart(loan.userId, 'loan_rejected', {
        persist: false,
        loanId: loan._id,
        data: {
          loanId: String(loan._id),
        },
      });
    }
    ok(res, loan, `Loan ${decision.toLowerCase()} successfully`);
  } catch (e) {
    next(e);
  }
});

// 🟣 Disburse Loan (after approval) - includes fund transfer simulation
router.post('/:id/disburse', requireAdmin, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan || loan.status !== 'APPROVED') {
      return fail(res, 'INVALID_STATE', 'Only approved loans can be disbursed');
    }

    const txnId = String(req.body?.txnId || '').trim();
    if (!txnId) {
      return fail(res, 'REFERENCE_REQUIRED', 'Enter the confirmed bank transfer reference before marking this loan disbursed.', 400);
    }

    // Simulate bank transfer to user's account
    const withdrawalAmount = loan.decision.amountApproved;
    const bankDetails = loan.application.bankDetails;

    // Create withdrawal transaction record (simulated)
    const withdrawalTxn = {
      type: 'WITHDRAWAL',
      amount: withdrawalAmount,
      bankName: bankDetails.bankName,
      accountNumber: bankDetails.accountNumber,
      ifscCode: bankDetails.ifscCode,
      accountHolderName: bankDetails.accountHolderName,
      txnId,
      status: 'COMPLETED',
      timestamp: new Date()
    };

    // Add withdrawal to loan record
    if (!loan.transactions) loan.transactions = [];
    loan.transactions.push(withdrawalTxn);

    loan.status = 'DISBURSED';
    loan.disbursementDate = new Date();
    loan.disbursement = {
      status: 'COMPLETED', amount: withdrawalAmount,
      netAmount: loan.decision?.netDisbursalAmount ?? withdrawalAmount,
      reference: txnId, initiatedAt: new Date(), completedAt: new Date()
    };
    loan.statusHistory.push({
      status: 'DISBURSED', title: 'Loan disbursed',
      message: 'Funds were transferred to your verified bank account.',
      actorType: 'ADMIN', actorId: req.admin.id
    });
    loan.schedule = createRepaymentSchedule(loan);
    await loan.save();

    await notifyUserSmart(loan.userId, 'loan_disbursed', {
      loanId: loan._id,
      loanAccountNumber: loan.loanAccountNumber,
      amount: withdrawalAmount,
      data: {
        loanId: String(loan._id),
        txnId: withdrawalTxn.txnId,
      },
    });

    ok(res, loan, 'Loan disbursed successfully - funds transferred to user account');
  } catch (e) {
    next(e);
  }
});

function createRepaymentSchedule(loan) {
  const emiCount = loan.decision?.tenureMonths || 12;
  const amt = loan.decision?.amountApproved || 0;
  const rate = loan.decision?.rateAPR || 12;
  const monthlyRate = rate / 12 / 100;
  const emi = monthlyRate > 0
    ? (amt * monthlyRate * Math.pow(1 + monthlyRate, emiCount)) /
      (Math.pow(1 + monthlyRate, emiCount) - 1)
    : amt / emiCount;

  const schedule = [];
  for (let i = 1; i <= emiCount; i++) {
    const due = new Date();
    due.setMonth(due.getMonth() + i);
    schedule.push({
      installmentNo: i,
      dueDate: due,
      principal: amt / emiCount,
      interest: emi - amt / emiCount,
      total: emi,
    });
  }
  return schedule;
}

export default router;
