import { Router } from 'express';
import { requireAdmin } from '../middlewares/adminAuth.js';
import MerchantBusiness from '../models/MerchantBusiness.js';
import MerchantKyc from '../models/MerchantKyc.js';
import MerchantBankAccount from '../models/MerchantBankAccount.js';
import MerchantQR from '../models/MerchantQR.js';
import MerchantPayment from '../models/MerchantPayment.js';
import MerchantSettlement from '../models/MerchantSettlement.js';
import { fail, ok } from '../utils/response.js';
import { activateMerchantQr } from '../utils/merchantQr.js';
import { notifyUserSmart } from '../services/smartNotifications.js';

const router = Router();

async function buildBusinessRow(business) {
  const [kyc, bank, qr, payments, settlements, paymentHistory, settlementHistory] = await Promise.all([
    MerchantKyc.findOne({ businessId: business._id }),
    MerchantBankAccount.findOne({ businessId: business._id }),
    MerchantQR.findOne({ businessId: business._id }),
    MerchantPayment.aggregate([
      { $match: { businessId: business._id } },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        successful: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
        collectedAmount: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0] } },
      } },
    ]),
    MerchantSettlement.aggregate([
      { $match: { businessId: business._id } },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        settledAmount: { $sum: { $cond: [{ $eq: ['$status', 'SETTLED'] }, '$amount', 0] } },
        pendingAmount: { $sum: { $cond: [{ $in: ['$status', ['REQUESTED', 'PROCESSING']] }, '$amount', 0] } },
      } },
    ]),
    MerchantPayment.find({ businessId: business._id })
      .sort({ createdAt: -1 })
      .limit(12)
      .select('orderId amount netAmount status customer checkoutUrl utr providerTransactionId createdAt creditedAt failedAt')
      .lean(),
    MerchantSettlement.find({ businessId: business._id })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean(),
  ]);
  const bankObject = bank?.toObject();
  if (bankObject?.accountNumber) {
    bankObject.accountNumberMasked = `****${String(bankObject.accountNumber).slice(-4)}`;
    delete bankObject.accountNumber;
  }
  return {
    business,
    kyc,
    bank: bankObject || null,
    qr,
    payments: payments[0] || { total: 0, successful: 0, collectedAmount: 0 },
    settlements: settlements[0] || { total: 0, settledAmount: 0, pendingAmount: 0 },
    history: {
      payments: paymentHistory,
      settlements: settlementHistory,
    },
  };
}

router.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const businesses = await MerchantBusiness.find().populate('userId', 'name email mobile').sort({ createdAt: -1 });
    const rows = await Promise.all(businesses.map(buildBusinessRow));
    ok(res, rows);
  } catch (error) { next(error); }
});

router.post('/:id/bank-status', requireAdmin, async (req, res, next) => {
  try {
    const status = String(req.body?.status || '').toUpperCase();
    const note = String(req.body?.note || '').trim();
    if (!['REVIEW', 'VERIFIED'].includes(status)) {
      return fail(res, 'INVALID_BANK_STATUS', 'Bank status must be REVIEW or VERIFIED.', 400);
    }

    const business = await MerchantBusiness.findById(req.params.id);
    if (!business) return fail(res, 'NOT_FOUND', 'Business profile not found.', 404);

    const bank = await MerchantBankAccount.findOne({ businessId: business._id });
    if (!bank) {
      return fail(res, 'BANK_DETAILS_REQUIRED', 'Bank details are not available for this business yet.', 409);
    }

    const now = new Date();
    const existingData = bank.verificationData && typeof bank.verificationData === 'object' ? bank.verificationData : {};
    bank.status = status;
    bank.verifiedAt = status === 'VERIFIED' ? now : bank.verifiedAt;
    bank.verificationProvider = status === 'VERIFIED' ? 'KHATU_PAY_ADMIN' : (bank.verificationProvider || 'KHATU_PAY_REVIEW');
    bank.verificationMessage = note || (status === 'VERIFIED'
      ? 'Bank account marked verified by Khatu Pay.'
      : 'Bank account marked for Khatu Pay review.');
    bank.verificationData = {
      ...existingData,
      adminReview: {
        status,
        note,
        reviewedBy: req.admin?.id,
        reviewedAt: now,
      },
    };
    await bank.save();

    const row = await buildBusinessRow(business);
    return ok(res, { row }, status === 'VERIFIED'
      ? 'Bank marked VERIFIED. QR can now be activated.'
      : 'Bank marked REVIEW. QR can now be activated.');
  } catch (error) { next(error); }
});

router.post('/:id/qr-status', requireAdmin, async (req, res, next) => {
  try {
    const status = String(req.body?.status || '').toUpperCase();
    const note = String(req.body?.note || '').trim();
    if (!['ACTIVE', 'DISABLED'].includes(status)) {
      return fail(res, 'INVALID_QR_STATUS', 'QR status must be ACTIVE or DISABLED.', 400);
    }

    const business = await MerchantBusiness.findById(req.params.id);
    if (!business) return fail(res, 'NOT_FOUND', 'Business profile not found.', 404);

    let qr = await MerchantQR.findOne({ businessId: business._id });
    if (status === 'ACTIVE') {
      if (String(business.status || '').toUpperCase() !== 'APPROVED') {
        return fail(res, 'BUSINESS_APPROVAL_REQUIRED', 'Approve the business profile before enabling QR.', 409);
      }
      const bank = await MerchantBankAccount.findOne({ businessId: business._id });
      if (!bank || !['VERIFIED', 'REVIEW'].includes(String(bank.status || '').toUpperCase())) {
        return fail(res, 'BANK_VERIFICATION_REQUIRED', 'Bank account must be VERIFIED or REVIEW before QR can be enabled.', 409);
      }
      qr = await activateMerchantQr(business);
    } else {
      if (!qr) return fail(res, 'QR_NOT_FOUND', 'Business QR has not been generated yet.', 404);
      qr.status = 'DISABLED';
      qr.disabledAt = new Date();
      qr.disabledReason = note || 'Disabled by Khatu Pay.';
      qr.statusHistory = [...(qr.statusHistory || []), {
        status: 'DISABLED',
        note: qr.disabledReason,
        actor: String(req.admin?.id || 'ADMIN'),
        at: new Date(),
      }].slice(-30);
      await qr.save();
    }

    const row = await buildBusinessRow(business);
    return ok(res, { row }, status === 'ACTIVE' ? 'Business QR enabled.' : 'Business QR disabled.');
  } catch (error) { next(error); }
});

router.post('/:id/decision', requireAdmin, async (req, res, next) => {
  try {
    const decision = String(req.body?.decision || '').toUpperCase();
    const business = await MerchantBusiness.findById(req.params.id);
    if (!business) return fail(res, 'NOT_FOUND', 'Business profile not found.', 404);
    if (decision === 'APPROVED') {
      const [kyc, bank] = await Promise.all([MerchantKyc.findOne({ businessId: business._id }), MerchantBankAccount.findOne({ businessId: business._id })]);
      if (!bank || !['VERIFIED', 'REVIEW'].includes(bank.status)) {
        return fail(res, 'BANK_VERIFICATION_REQUIRED', 'A SignCare verified or Khatu Pay review bank account is required before approval.', 409);
      }
      if (kyc) {
        kyc.status = 'VERIFIED'; kyc.reviewedAt = new Date();
      }
      business.status = 'APPROVED'; business.rejectionReason = '';
      const qr = await activateMerchantQr(business);
      await Promise.all([...(kyc ? [kyc.save()] : []), business.save()]);
      notifyUserSmart(business.userId, 'business_qr_approved', {
        email: true,
        force: true,
        businessName: business.businessName,
        reference: business.publicId,
        route: '/business/qr',
        dedupeKey: `business-qr-approved:${business._id}:${new Date().toISOString().slice(0, 10)}`,
        data: {
          businessId: String(business._id),
          publicId: business.publicId,
          qrReference: qr.qrReference,
          paymentUrl: qr.paymentUrl,
          provider: qr.provider || 'VELXAPAY',
        },
      }).catch((error) => console.error('Business QR approval email failed:', error.message));
      return ok(res, { business, qr }, 'Business approved and QR activated.');
    } else if (decision === 'REJECTED') {
      const reason = String(req.body?.reason || '').trim();
      if (!reason) return fail(res, 'REASON_REQUIRED', 'Enter a customer-friendly rejection reason.', 400);
      business.status = 'REJECTED'; business.rejectionReason = reason; await business.save();
      notifyUserSmart(business.userId, 'business_qr_rejected', {
        email: true,
        force: true,
        businessName: business.businessName,
        reason,
        reference: business.publicId,
        route: '/business/verification',
        dedupeKey: `business-qr-rejected:${business._id}:${new Date().toISOString().slice(0, 10)}`,
        data: { businessId: String(business._id), publicId: business.publicId, status: business.status },
      }).catch((error) => console.error('Business QR rejection email failed:', error.message));
    } else return fail(res, 'INVALID_DECISION', 'Decision must be APPROVED or REJECTED.', 400);
    ok(res, { business }, `Business ${decision.toLowerCase()}.`);
  } catch (error) { next(error); }
});
export default router;
