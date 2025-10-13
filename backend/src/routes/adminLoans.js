import { Router } from 'express';
import Loan from '../models/Loan.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

// 🟢 Get all loan applications (paginated)
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { status = 'ALL', page = 1, limit = 20 } = req.query;
    const query = status === 'ALL' ? {} : { status };
    const loans = await Loan.find(query)
      .populate('userId', 'name email mobile')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Loan.countDocuments(query);
    ok(res, { items: loans, total });
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
    } else if (decision === 'REJECTED') {
      loan.status = 'REJECTED';
      loan.decision = {
        decidedAt: new Date(),
        decidedBy: req.admin.uid,
      };
    } else {
      return fail(res, 'INVALID', 'Invalid decision');
    }

    await loan.save();
    ok(res, loan, `Loan ${decision.toLowerCase()} successfully`);
  } catch (e) {
    next(e);
  }
});

// 🟣 Disburse Loan (after approval)
router.post('/:id/disburse', requireAdmin, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan || loan.status !== 'APPROVED') {
      return fail(res, 'INVALID_STATE', 'Only approved loans can be disbursed');
    }

    const { txnId } = req.body;
    loan.status = 'DISBURSED';
    loan.schedule = createRepaymentSchedule(loan);
    await loan.save();
    ok(res, loan, 'Loan disbursed successfully');
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
