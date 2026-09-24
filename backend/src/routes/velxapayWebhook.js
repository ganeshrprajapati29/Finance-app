import { Router } from 'express';
import MerchantPayment from '../models/MerchantPayment.js';
import MerchantSettlement from '../models/MerchantSettlement.js';
import MerchantPayout from '../models/MerchantPayout.js';
import { emitToUser } from '../realtime.js';
import { fail, ok } from '../utils/response.js';
import { verifyVelxapayWebhook } from '../services/velxapay/signatureService.js';
import { creditMerchantCollection } from '../services/velxapay/webhookService.js';

const router = Router();
router.post('/', async (req, res, next) => {
  try {
    const signature = req.get('x-velxapay-signature') || req.get('x-signature');
    if (!verifyVelxapayWebhook(req.rawBody, signature)) return fail(res, 'INVALID_SIGNATURE', 'Invalid webhook signature.', 401);
    const { type, status, orderId, orderAmount, realAmount, platOrderNum, utr } = req.body || {};
    const normalized = String(status || '').toLowerCase();
    if (String(type).toUpperCase() === 'DEPOSIT') {
      const payment = await MerchantPayment.findOne({ orderId: String(orderId || '') });
      if (!payment) return ok(res, { received: true }, 'Webhook acknowledged.');
      if (normalized === 'success') {
        const received = Number(realAmount ?? orderAmount);
        if (!Number.isFinite(received) || Math.abs(received - Number(payment.amount)) > 0.01) {
          return fail(res, 'AMOUNT_MISMATCH', 'Webhook amount does not match the order.', 400);
        }
        await creditMerchantCollection({ orderId: payment.orderId, amount: received, utr, provider: { webhook: req.body } });
        payment.status = 'SUCCESS'; payment.utr = utr || payment.utr;
      } else if (normalized === 'failed') { payment.status = 'FAILED'; payment.failedAt = new Date(); }
      if (normalized !== 'success') { payment.provider = { ...(payment.provider || {}), webhook: req.body }; await payment.save(); }
      emitToUser(payment.merchantUserId, 'merchant:payment', { orderId: payment.orderId, status: payment.status, amount: payment.amount, utr: payment.utr });
    } else if (String(type).toUpperCase() === 'WITHDRAW') {
      const reference = String(platOrderNum || orderId || '').trim();
      if (!reference) return ok(res, { received: true }, 'Webhook acknowledged.');
      const payout = await MerchantPayout.findOne({
        $or: [
          { providerOrderId: reference },
          { 'request.order_id': reference },
          { 'request.orderId': reference },
          { 'response.data.platOrderNum': reference },
          { 'response.platOrderNum': reference },
        ],
      });
      if (payout) {
        payout.status = normalized === 'success' ? 'SUCCESS' : normalized === 'failed' ? 'FAILED' : 'PROCESSING'; payout.utr = utr; payout.response = req.body; await payout.save();
        const settlement = await MerchantSettlement.findById(payout.settlementId);
        if (settlement) {
          settlement.status = payout.status === 'SUCCESS' ? 'SETTLED' : payout.status === 'FAILED' ? 'FAILED' : 'PROCESSING';
          settlement.utr = utr; settlement.providerReference = platOrderNum;
          if (payout.status === 'SUCCESS') settlement.settledAt = new Date();
          await settlement.save();
          emitToUser(settlement.userId, 'merchant:settlement', { settlementId: settlement.settlementId, status: settlement.status, amount: settlement.amount, utr });
        }
      }
    }
    ok(res, { received: true }, 'Webhook acknowledged.');
  } catch (error) { next(error); }
});
export default router;
