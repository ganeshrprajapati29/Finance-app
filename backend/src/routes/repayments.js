import { Router } from 'express';
import Loan from '../models/Loan.js';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

// Pay installment (mock)
router.post('/:loanId/pay/:installment', requireAuth, async (req, res, next) => {
  try {
    const { loanId, installment } = req.params;
    const loan = await Loan.findOne({ _id: loanId, userId: req.user.uid });
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);

    const inst = loan.schedule.find(
      (x) => x.installmentNo === parseInt(installment)
    );
    if (!inst) return fail(res, 'INVALID', 'Installment not found');

    if (inst.paid) return fail(res, 'ALREADY_PAID', 'Already paid');

    inst.paid = true;
    inst.paidAt = new Date();
    inst.paymentId = 'TXN' + Date.now();

    await loan.save();
    ok(res, inst, 'Payment recorded successfully');
  } catch (e) {
    next(e);
  }
});

// User repayment history
router.get('/:loanId', requireAuth, async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.loanId, userId: req.user.uid });
    if (!loan) return fail(res, 'NOT_FOUND', 'Loan not found', 404);
    ok(res, loan.schedule || []);
  } catch (e) {
    next(e);
  }
});

export default router;
