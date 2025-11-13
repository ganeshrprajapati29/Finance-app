import { Router } from 'express';
import Joi from 'joi';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import User from '../models/User.js';
import Loan from '../models/Loan.js';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

// Create withdrawal request
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const schema = Joi.object({
      amount: Joi.number().required(),
      bankDetails: Joi.object({
        bankName: Joi.string().required(),
        accountNumber: Joi.string().required(),
        ifscCode: Joi.string().required(),
        accountHolderName: Joi.string().required(),
      }).required(),
    });

    const payload = await schema.validateAsync(req.body);

    const user = await User.findById(req.user.uid);
    if (!user) return fail(res, 'USER_NOT_FOUND', 'User not found', 404);

    if (payload.amount > user.loanLimit.amount) {
      return fail(res, 'INSUFFICIENT_BALANCE', 'Insufficient available balance', 400);
    }

    const withdrawal = await WithdrawalRequest.create({
      userId: req.user.uid,
      amount: payload.amount,
      bankDetails: payload.bankDetails,
    });

    ok(res, withdrawal, 'Withdrawal request submitted');
  } catch (e) { next(e); }
});

// Get my withdrawal requests
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const withdrawals = await WithdrawalRequest.find({ userId: req.user.uid }).sort({ createdAt: -1 });
    ok(res, withdrawals);
  } catch (e) { next(e); }
});

export default router;
