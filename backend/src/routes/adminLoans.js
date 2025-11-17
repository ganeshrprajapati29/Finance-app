import { Router } from 'express';
import Loan from '../models/Loan.js';
import Notification from '../models/Notification.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';
import { quickSort, mergeSort, PriorityQueue } from '../utils/dsa.js';

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

    // If loans need custom sorting (e.g., by due dates), use DSA algorithms
    if (sortBy === 'nextDueDate' && loans.length > 0) {
      const compareFn = (a, b) => {
        const aDue = a.schedule?.find(s => !s.paid)?.dueDate?.getTime() || Infinity;
        const bDue = b.schedule?.find(s => !s.paid)?.dueDate?.getTime() || Infinity;
        return sortOrder === 'desc' ? bDue - aDue : aDue - bDue;
      };
      const sortedLoans = quickSort(loans, compareFn);
      ok(res, { items: sortedLoans, total });
    } else {
      ok(res, { items: loans, total });
    }
  } catch (e) {
    next(e);
  }
});

// 🟡 Approve / Reject Loan
router.post('/:id/decision', requireAdmin, async (req, res, next) => {
  try {
    const { decision, amountApproved, rateAPR, tenureMonths } = req.body;
    const loan = await Loan.findById(req.params.id);
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);

    if (decision === 'APPROVED') {
      loan.status = 'APPROVED';
      loan.decision = {
        amountApproved,
        rateAPR,
        tenureMonths,
        decidedAt: new Date(),
        decidedBy: req.admin.uid,
      };

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
      loan.status = 'REJECTED';
      loan.decision = {
        decidedAt: new Date(),
        decidedBy: req.admin.uid,
      };

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

    const { txnId } = req.body;

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
      txnId: txnId || `WD-${Date.now()}`,
      status: 'COMPLETED',
      timestamp: new Date()
    };

    // Add withdrawal to loan record
    if (!loan.transactions) loan.transactions = [];
    loan.transactions.push(withdrawalTxn);

    loan.status = 'DISBURSED';
    loan.disbursementDate = new Date();
    loan.schedule = createRepaymentSchedule(loan);
    await loan.save();

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
  const emi =
    (amt * monthlyRate * Math.pow(1 + monthlyRate, emiCount)) /
    (Math.pow(1 + monthlyRate, emiCount) - 1);

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
