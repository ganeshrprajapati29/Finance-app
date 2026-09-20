import MerchantPayment from '../../models/MerchantPayment.js';
import MerchantLedger from '../../models/MerchantLedger.js';

export async function creditMerchantCollection({ orderId, amount, utr, provider }) {
  const payment = await MerchantPayment.findOne({ orderId });
  if (!payment) return { payment: null, credited: false };
  const received = Number(amount);
  if (!Number.isFinite(received) || Math.abs(received - Number(payment.amount)) > 0.01) {
    const error = new Error('Provider amount does not match the merchant order.');
    error.status = 400; error.code = 'AMOUNT_MISMATCH'; throw error;
  }
  const result = await MerchantLedger.updateOne(
    { idempotencyKey: `VELXA:DEPOSIT:${payment.orderId}` },
    { $setOnInsert: { businessId: payment.businessId, userId: payment.merchantUserId, paymentId: payment._id, type: 'COLLECTION_CREDIT', amount: received, availableOn: new Date(Date.now() + 24 * 60 * 60 * 1000), status: 'PENDING', description: `Collection ${payment.orderId}` } },
    { upsert: true }
  );
  payment.status = 'SUCCESS'; payment.netAmount = received; payment.utr = utr || payment.utr;
  payment.creditedAt = payment.creditedAt || new Date();
  payment.provider = { ...(payment.provider || {}), ...(provider || {}) };
  await payment.save();
  return { payment, credited: result.upsertedCount === 1 };
}
