import ClubAPITransaction from '../routes/clubapi/models/transaction.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { generateURID, formatAmount, getTransactionType, validateResponse } from '../routes/clubapi/helper.js';
import { callClubAPITransaction } from './clubapiUtility.js';
import { getRazorpay } from './razorpay.js';
import { emitToUser } from '../realtime.js';

export function clubStatusToLocal(data = {}) {
  const raw = String(data.status || data.txnStatus || data.transactionStatus || data.resCode || '').toUpperCase();
  const text = String(data.resText || data.message || data.statusMessage || '').toLowerCase();
  if (raw === 'SUCCESS' || raw === 'COMPLETED' || /success|completed/.test(text)) return 'completed';
  if (['FAILED', 'FAILURE', 'ERROR', 'CANCELLED', 'CANCELED'].includes(raw) || /fail|error|cancel|reject/.test(text)) return 'failed';
  return 'processing';
}

function emitClubTransaction(userId, transaction) {
  if (!userId) return;
  emitToUser(userId, 'clubapi:transaction_updated', {
    urid: transaction.urid,
    status: transaction.status,
    type: transaction.type,
    amount: transaction.amount,
    transaction
  });
}

function firstOrderId(data = {}) {
  const nested = data.data && typeof data.data === 'object' ? data.data : {};
  if (Array.isArray(data.data) && data.data[0]) return data.data[0].orderId || data.data[0].order_id || '';
  return data.orderId || data.order_id || nested.orderId || nested.order_id || '';
}

function rechargeMetaFromPayment(payment) {
  const meta = payment.metadata?.recharge || {};
  return {
    type: meta.type,
    operatorId: meta.operatorId,
    accountRef: meta.accountRef,
    amount: meta.amount || payment.amount,
    customerMobile: meta.customerMobile,
    cbId: meta.cbId,
    opvalue1: meta.opvalue1,
    opvalue2: meta.opvalue2,
    opvalue3: meta.opvalue3,
    opvalue4: meta.opvalue4,
    opvalue5: meta.opvalue5
  };
}

export async function refundRechargePayment(payment, reason = 'Recharge failed') {
  if (!payment || payment.metadata?.refund?.status) return payment?.metadata?.refund || null;

  const refund = {
    status: 'PENDING',
    reason,
    amount: payment.amount,
    attemptedAt: new Date()
  };

  try {
    if (payment.gateway?.paymentId) {
      const rz = getRazorpay();
      const rzRefund = await rz.payments.refund(payment.gateway.paymentId, {
        amount: Math.round(Number(payment.amount || 0) * 100),
        notes: { reason, khatuPaymentId: payment.khatuPaymentId || String(payment._id) }
      });
      refund.status = 'RAZORPAY_REFUNDED';
      refund.razorpayRefundId = rzRefund.id;
      refund.response = rzRefund;
      payment.status = 'REFUNDED';
    } else {
      throw new Error('Razorpay payment id is missing');
    }
  } catch (error) {
    await User.findByIdAndUpdate(payment.userId, { $inc: { walletBalance: Number(payment.amount || 0) } });
    refund.status = 'WALLET_CREDITED';
    refund.error = error.message;
    refund.walletCreditedAt = new Date();
    payment.status = 'REFUNDED';
  }

  payment.metadata = {
    ...(payment.metadata?.toObject?.() || payment.metadata || {}),
    refund
  };
  await payment.save();
  return refund;
}

export async function processPaidRecharge(payment) {
  if (!payment) throw new Error('Payment not found');
  if (payment.type !== 'RECHARGE') throw new Error('Payment is not a recharge payment');
  if (!['CONFIRMED', 'REFUNDED'].includes(payment.status)) throw new Error('Payment is not confirmed');

  if (payment.metadata?.clubapiTransactionId) {
    const existing = await ClubAPITransaction.findById(payment.metadata.clubapiTransactionId);
    if (existing) return { transaction: existing, refund: payment.metadata?.refund || null, reused: true };
  }

  const recharge = rechargeMetaFromPayment(payment);
  const required = ['type', 'operatorId', 'accountRef', 'amount'];
  for (const field of required) {
    if (!recharge[field]) throw new Error(`Recharge ${field} is missing`);
  }

  const urid = generateURID();
  const amount = Number(formatAmount(recharge.amount));
  const transactionType = getTransactionType(recharge.type);
  const transaction = await ClubAPITransaction.create({
    urid,
    type: transactionType,
    status: 'processing',
    amount,
    provider: recharge.operatorId,
    accountRef: recharge.accountRef,
    customerMobile: recharge.customerMobile,
    userId: payment.userId,
    paymentId: payment._id
  });

  payment.metadata = {
    ...(payment.metadata?.toObject?.() || payment.metadata || {}),
    clubapiTransactionId: transaction._id,
    rechargeProcessedAt: new Date(),
    recharge: {
      ...recharge,
      urid
    }
  };
  await payment.save();
  emitClubTransaction(payment.userId, transaction);

  try {
    const response = validateResponse(await callClubAPITransaction({
      urid,
      operatorId: recharge.operatorId,
      mobile: recharge.accountRef,
      amount: String(amount),
      cbId: recharge.cbId,
      customerMobile: recharge.customerMobile,
      opvalue1: recharge.opvalue1,
      opvalue2: recharge.opvalue2,
      opvalue3: recharge.opvalue3,
      opvalue4: recharge.opvalue4,
      opvalue5: recharge.opvalue5
    }));

    transaction.status = clubStatusToLocal(response);
    transaction.response = response;
    await transaction.save();

    payment.metadata = {
      ...(payment.metadata?.toObject?.() || payment.metadata || {}),
      recharge: {
        ...(payment.metadata?.recharge || {}),
        orderId: firstOrderId(response),
        clubapiStatus: transaction.status,
        response
      }
    };

    let refund = null;
    if (transaction.status === 'failed') {
      refund = await refundRechargePayment(payment, 'Recharge failed at ClubAPI');
      transaction.refund = refund;
      await transaction.save();
    } else {
      await payment.save();
    }

    emitClubTransaction(payment.userId, transaction);
    return { transaction, refund, response };
  } catch (error) {
    transaction.status = 'failed';
    transaction.response = { message: error.message };
    const refund = await refundRechargePayment(payment, error.message || 'Recharge request failed');
    transaction.refund = refund;
    await transaction.save();
    emitClubTransaction(payment.userId, transaction);
    return { transaction, refund, error: error.message };
  }
}

export async function handleRechargeCallbackRefund(transaction) {
  if (!transaction || transaction.status !== 'failed' || !transaction.paymentId) return null;
  const payment = await Payment.findById(transaction.paymentId);
  if (!payment || payment.metadata?.refund?.status) return payment?.metadata?.refund || null;
  const refund = await refundRechargePayment(payment, 'Recharge failed by ClubAPI callback');
  transaction.refund = refund;
  await transaction.save();
  return refund;
}
