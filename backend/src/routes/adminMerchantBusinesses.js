import { Router } from 'express';
import { requireAdmin } from '../middlewares/adminAuth.js';
import MerchantBusiness from '../models/MerchantBusiness.js';
import MerchantKyc from '../models/MerchantKyc.js';
import MerchantBankAccount from '../models/MerchantBankAccount.js';
import { fail, ok } from '../utils/response.js';

const router = Router();
router.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const businesses = await MerchantBusiness.find().populate('userId', 'name email mobile').sort({ createdAt: -1 });
    const rows = await Promise.all(businesses.map(async (business) => ({ business, kyc: await MerchantKyc.findOne({ businessId: business._id }), bank: await MerchantBankAccount.findOne({ businessId: business._id }).select('-accountNumber') })));
    ok(res, rows);
  } catch (error) { next(error); }
});
router.post('/:id/decision', requireAdmin, async (req, res, next) => {
  try {
    const decision = String(req.body?.decision || '').toUpperCase();
    const business = await MerchantBusiness.findById(req.params.id);
    if (!business) return fail(res, 'NOT_FOUND', 'Business profile not found.', 404);
    if (decision === 'APPROVED') {
      const [kyc, bank] = await Promise.all([MerchantKyc.findOne({ businessId: business._id }), MerchantBankAccount.findOne({ businessId: business._id })]);
      if (!kyc || !bank) return fail(res, 'VERIFICATION_INCOMPLETE', 'KYC and bank account are required before approval.', 409);
      kyc.status = 'VERIFIED'; kyc.reviewedAt = new Date(); bank.status = 'VERIFIED'; bank.verifiedAt = new Date();
      business.status = 'APPROVED'; business.rejectionReason = '';
      await Promise.all([kyc.save(), bank.save(), business.save()]);
    } else if (decision === 'REJECTED') {
      const reason = String(req.body?.reason || '').trim();
      if (!reason) return fail(res, 'REASON_REQUIRED', 'Enter a customer-friendly rejection reason.', 400);
      business.status = 'REJECTED'; business.rejectionReason = reason; await business.save();
    } else return fail(res, 'INVALID_DECISION', 'Decision must be APPROVED or REJECTED.', 400);
    ok(res, business, `Business ${decision.toLowerCase()}.`);
  } catch (error) { next(error); }
});
export default router;
