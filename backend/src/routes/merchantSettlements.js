import crypto from 'crypto';
import { Router } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import { requireAuth } from '../middlewares/auth.js';
import MerchantBusiness from '../models/MerchantBusiness.js';
import MerchantBankAccount from '../models/MerchantBankAccount.js';
import MerchantLedger from '../models/MerchantLedger.js';
import MerchantSettlement from '../models/MerchantSettlement.js';
import MerchantPayout from '../models/MerchantPayout.js';
import { created, fail, ok } from '../utils/response.js';

const router = Router();
async function availableBalance(userId) {
  const id = new mongoose.Types.ObjectId(userId);
  const credits = await MerchantLedger.aggregate([
    { $match: { userId: id, type: 'COLLECTION_CREDIT', status: 'AVAILABLE' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const debits = await MerchantSettlement.aggregate([
    { $match: { userId: id, status: { $in: ['REQUESTED', 'PROCESSING', 'SETTLED'] } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return Math.max(0, Number(credits[0]?.total || 0) - Number(debits[0]?.total || 0));
}
router.get('/', requireAuth, async (req, res, next) => {
  try { ok(res, await MerchantSettlement.find({ userId: req.user.uid }).sort({ createdAt: -1 })); } catch (error) { next(error); }
});
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const row = await MerchantSettlement.findOne({ _id: req.params.id, userId: req.user.uid }).populate('bankAccountId', 'bankName accountNumber ifscCode accountHolderName');
    if (!row) return fail(res, 'NOT_FOUND', 'Settlement not found.', 404);
    const data = row.toObject();
    if (data.bankAccountId?.accountNumber) data.bankAccountId.accountNumber = `****${data.bankAccountId.accountNumber.slice(-4)}`;
    ok(res, data);
  } catch (error) { next(error); }
});
router.post('/request', requireAuth, async (req, res, next) => {
  try {
    const { amount } = await Joi.object({ amount: Joi.number().positive().precision(2).required() }).validateAsync(req.body);
    const business = await MerchantBusiness.findOne({ userId: req.user.uid, status: 'APPROVED' });
    if (!business) return fail(res, 'APPROVAL_REQUIRED', 'Business approval is required for settlement.', 409);
    const bank = await MerchantBankAccount.findOne({ businessId: business._id, status: 'VERIFIED' });
    if (!bank) return fail(res, 'BANK_VERIFICATION_REQUIRED', 'Verify your settlement bank account first.', 409);
    const available = await availableBalance(business.userId);
    if (Number(amount) > available) return fail(res, 'INSUFFICIENT_BALANCE', 'Settlement amount is higher than your available balance.', 409, { available });
    const settlement = await MerchantSettlement.create({
      businessId: business._id, userId: business.userId, bankAccountId: bank._id,
      settlementId: `KPS${Date.now()}${crypto.randomInt(100, 999)}`,
      amount: Number(amount), status: 'REQUESTED', requestedAt: new Date(),
    });
    await MerchantPayout.create({ settlementId: settlement._id, businessId: business._id, amount: Number(amount), status: 'QUEUED' });
    created(res, settlement, 'Settlement request queued. Bank transfer status will update after provider confirmation.');
  } catch (error) { next(error); }
});
export default router;
