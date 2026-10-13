import crypto from 'crypto';
import { Router } from 'express';
import MerchantBusiness from '../models/MerchantBusiness.js';
import MerchantLedger from '../models/MerchantLedger.js';
import MerchantPayment from '../models/MerchantPayment.js';
import MerchantSettlement from '../models/MerchantSettlement.js';
import MerchantBankAccount from '../models/MerchantBankAccount.js';
import { mapRazorpayAccountStatus } from '../services/razorpayPartner.js';

const router = Router();
const clean = (value) => String(value || '').trim();
const paiseToRupees = (value) => Number(value || 0) / 100;

const businessForEvent = async (event) => {
  const payment = event.payload?.payment?.entity || event.payload?.payment || {};
  const account = event.payload?.account?.entity || event.payload?.account || {};
  const product = event.payload?.product?.entity || event.payload?.product || {};
  const accountId = account.id || product.account_id || payment.account_id;
  if (accountId) return MerchantBusiness.findOne({ 'razorpay.accountId': accountId });
  const publicId = payment.notes?.khatupay_business_id || event.notes?.khatupay_business_id;
  return publicId ? MerchantBusiness.findOne({ publicId }) : null;
};

const syncPayment = async (business, event) => {
  const payment = event.payload?.payment?.entity || event.payload?.payment || {};
  const paymentId = clean(payment.id);
  if (!paymentId) return;
  const eventName = clean(event.event).toLowerCase();
  const captured = eventName === 'payment.captured' || payment.status === 'captured';
  const failed = eventName === 'payment.failed' || payment.status === 'failed';
  const amount = paiseToRupees(payment.amount);
  const status = captured ? 'SUCCESS' : failed ? 'FAILED' : 'PENDING';
  const record = await MerchantPayment.findOneAndUpdate(
    { providerTransactionId: paymentId },
    {
      $set: {
        businessId: business._id, merchantUserId: business.userId,
        orderId: clean(payment.order_id) || paymentId,
        amount, netAmount: paiseToRupees(payment.fee ? Number(payment.amount || 0) - Number(payment.fee || 0) : payment.amount),
        currency: payment.currency || 'INR', status, providerTransactionId: paymentId,
        utr: payment.acquirer_data?.rrn || payment.acquirer_data?.upi_transaction_id || undefined,
        customer: { email: payment.email || undefined, phone: payment.contact || undefined },
        provider: { paymentId, orderId: payment.order_id, method: payment.method, vpa: payment.vpa, status: payment.status },
        ...(captured ? { creditedAt: new Date() } : {}),
        ...(failed ? { failedAt: new Date() } : {}),
      },
    }, { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (captured) {
    await MerchantLedger.findOneAndUpdate(
      { idempotencyKey: `razorpay:payment:${paymentId}:credit` },
      { $setOnInsert: { businessId: business._id, userId: business.userId, paymentId: record._id, idempotencyKey: `razorpay:payment:${paymentId}:credit`, type: 'COLLECTION_CREDIT', amount, status: 'AVAILABLE', availableOn: new Date(), description: 'Razorpay QR collection' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
};

const syncRefund = async (business, event) => {
  const refund = event.payload?.refund?.entity || event.payload?.refund || {};
  const paymentId = clean(refund.payment_id);
  if (!paymentId) return;
  const record = await MerchantPayment.findOne({ businessId: business._id, providerTransactionId: paymentId });
  if (!record) return;
  const refundAmount = paiseToRupees(refund.amount);
  const totalRefunded = Math.min(record.amount, Number(record.refundedAmount || 0) + refundAmount);
  record.refundedAmount = totalRefunded;
  record.refundedAt = new Date();
  record.status = totalRefunded >= record.amount ? 'REFUNDED' : 'SUCCESS';
  await record.save();
  await MerchantLedger.findOneAndUpdate(
    { idempotencyKey: `razorpay:refund:${clean(refund.id)}` },
    { $setOnInsert: { businessId: business._id, userId: business.userId, paymentId: record._id, idempotencyKey: `razorpay:refund:${clean(refund.id)}`, type: 'REVERSAL', amount: -refundAmount, status: 'REVERSED', description: 'Razorpay payment refund' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

const syncSettlement = async (business, event) => {
  const settlement = event.payload?.settlement?.entity || event.payload?.settlement || {};
  const settlementId = clean(settlement.id);
  if (!settlementId) return;
  const bank = await MerchantBankAccount.findOne({ businessId: business._id });
  if (!bank) return;
  const state = clean(settlement.status).toLowerCase();
  const status = ['processed', 'settled'].includes(state)
    ? 'SETTLED'
    : ['failed', 'reversed'].includes(state)
        ? 'FAILED'
        : state === 'created'
            ? 'REQUESTED'
            : 'PROCESSING';
  await MerchantSettlement.findOneAndUpdate(
    { settlementId },
    {
      businessId: business._id,
      userId: business.userId,
      bankAccountId: bank._id,
      settlementId,
      amount: paiseToRupees(settlement.amount),
      status,
      providerReference: settlement.utr || settlementId,
      utr: settlement.utr,
      failureReason: settlement.error_description || settlement.error?.description,
      ...(status === 'SETTLED' ? { settledAt: new Date() } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

router.post('/', async (req, res) => {
  const secret = clean(process.env.RAZORPAY_PARTNER_WEBHOOK_SECRET);
  const rawBody = req.rawBody;
  const signature = req.get('x-razorpay-signature');
  if (!secret || !rawBody || !signature) return res.status(400).json({ success: false, message: 'Invalid webhook payload.' });
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
  try {
    const event = JSON.parse(rawBody.toString('utf8'));
    const account = event.payload?.account?.entity || event.payload?.account || {};
    const product = event.payload?.product?.entity || event.payload?.product || {};
    const accountId = account.id || product.account_id;
    if (accountId) {
      const status = product.status || account.status;
      await MerchantBusiness.findOneAndUpdate({ 'razorpay.accountId': accountId }, {
        $set: {
          status: mapRazorpayAccountStatus(status), 'razorpay.accountStatus': account.status || status,
          'razorpay.productStatus': product.status, 'razorpay.productId': product.id,
          'razorpay.requirements': product.requirements || account.requirements, 'razorpay.lastSyncedAt': new Date(),
        },
      });
    }
    const business = await businessForEvent(event);
    if (business) {
      if (String(event.event || '').startsWith('payment.')) await syncPayment(business, event);
      if (String(event.event || '') === 'refund.processed') await syncRefund(business, event);
      if (String(event.event || '').startsWith('settlement.')) await syncSettlement(business, event);
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[razorpay-partner] webhook error:', error.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed.' });
  }
});

export default router;
