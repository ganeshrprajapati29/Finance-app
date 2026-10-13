import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import MerchantBusiness from '../models/MerchantBusiness.js';
import MerchantBankAccount from '../models/MerchantBankAccount.js';
import MerchantSettlement from '../models/MerchantSettlement.js';
import { fail, ok } from '../utils/response.js';
import { razorpayPartnerV1Request } from '../services/razorpayPartner.js';

const router = Router();
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
    return fail(res, 'AUTOMATIC_SETTLEMENTS', 'Razorpay settles approved business collections to the verified bank account according to the merchant settlement schedule. Refresh this page to track the status.', 409);
  } catch (error) { next(error); }
});
router.post('/sync', requireAuth, async (req, res, next) => {
  try {
    const business = await MerchantBusiness.findOne({ userId: req.user.uid });
    if (!business?.razorpay?.accountId) return fail(res, 'RAZORPAY_ONBOARDING_REQUIRED', 'Complete Razorpay business onboarding before syncing settlements.', 409);
    const bank = await MerchantBankAccount.findOne({ businessId: business._id });
    if (!bank) return fail(res, 'BANK_DETAILS_REQUIRED', 'Add your settlement bank account before syncing settlements.', 409);
    const data = await razorpayPartnerV1Request(
      'get',
      '/v1/settlements?count=100',
      undefined,
      { accountId: business.razorpay.accountId },
    );
    for (const item of data.items || []) {
      const state = String(item.status || '').toLowerCase();
      const status = ['processed', 'settled'].includes(state) ? 'SETTLED' : ['failed', 'reversed'].includes(state) ? 'FAILED' : state === 'created' ? 'REQUESTED' : 'PROCESSING';
      await MerchantSettlement.findOneAndUpdate({ settlementId: item.id }, { businessId: business._id, userId: business.userId, bankAccountId: bank._id, settlementId: item.id, amount: Number(item.amount || 0) / 100, status, providerReference: item.utr || item.id, utr: item.utr, ...(status === 'SETTLED' ? { settledAt: new Date(Number(item.created_at || Math.floor(Date.now() / 1000)) * 1000) } : {}) }, { upsert: true, new: true });
    }
    ok(res, { synced: (data.items || []).length }, 'Settlement history updated.');
  } catch (error) { next(error); }
});
export default router;
