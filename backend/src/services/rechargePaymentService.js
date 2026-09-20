import mongoose from 'mongoose';

import ClubAPITransaction from '../models/ClubAPITransaction.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import Invoice from '../models/Invoice.js';
import { generateURID } from '../routes/clubapi/helper.js';
import { emitToUser } from '../realtime.js';
import { getRazorpay, toPaise } from './razorpay.js';
import {
  decideTransactionOutcome,
  normalizeStatusCheckResponse,
  normalizeStatusWord,
  normalizeTransactionResponse,
  toLocalStatus,
} from './clubapiResponse.js';
import { sendBillPayment, sendRecharge, sendStatusCheck } from './clubapiClient.js';

/**
 * Runs a paid recharge / bill payment at ClubAPI and keeps the customer whole.
 *
 * Money-safety rules enforced here:
 *  1. A payment is sent to ClubAPI at most once (atomic claim on the payment).
 *  2. A timeout is PENDING, not FAILED - ClubAPI may still complete it, so the
 *     customer is only refunded once a failure is confirmed.
 *  3. A payment is refunded at most once (atomic claim on metadata.refund),
 *     no matter how many callbacks, status checks or retries race.
 *  4. An unauthenticated callback never triggers a refund on its own; the
 *     outcome is verified with ClubAPI's status API first.
 */

const STATUS_CHECK_INTERVAL_MS = 20 * 1000;
const NOT_FOUND_MIN_AGE_MS = 10 * 60 * 1000;
const NOT_FOUND_MAX_AGE_MS = 60 * 60 * 1000;
const PAYABLE_TYPES = ['mobile', 'dth', 'bill_payment'];

/** Backwards-compatible status mapper for older callers. */
export function clubStatusToLocal(data = {}) {
  return toLocalStatus(normalizeTransactionResponse(data).status);
}

function emitClubTransaction(userId, transaction) {
  if (!userId || !transaction) return;
  emitToUser(userId, 'clubapi:transaction_updated', {
    urid: transaction.urid,
    status: transaction.status,
    type: transaction.type,
    amount: transaction.amount,
    transaction,
  });
}

async function notify(userId, event, context) {
  try {
    const { notifyUserSmart } = await import('./smartNotifications.js');
    await notifyUserSmart(userId, event, context);
  } catch (error) {
    console.error(`Notification ${event} failed:`, error.message);
  }
}

/* ------------------------------------------------------------------ refunds */

/**
 * Refunds a service payment exactly once.
 *
 * Razorpay payments go back to the original method; wallet payments (and
 * Razorpay refunds the gateway definitively rejects) are credited to the
 * Khatu wallet. A Razorpay refund that fails for an unknown reason (network)
 * is parked as REVIEW_REQUIRED instead of also crediting the wallet, which
 * could otherwise refund the customer twice.
 */
export async function refundClubAPIPayment(paymentOrId, reason = 'Service could not be completed') {
  const paymentId = paymentOrId?._id || paymentOrId;
  if (!paymentId) return null;

  const claimed = await Payment.findOneAndUpdate(
    {
      _id: paymentId,
      status: 'CONFIRMED',
      'metadata.refund.status': { $exists: false },
    },
    { $set: { 'metadata.refund': { status: 'PROCESSING', reason, claimedAt: new Date() } } },
    { new: true }
  );

  if (!claimed) {
    const current = await Payment.findById(paymentId).select('metadata.refund').lean();
    return current?.metadata?.refund || null;
  }

  const amount = Number(claimed.amount || 0);
  const refund = { reason, amount, attemptedAt: new Date() };
  let paymentStatus = 'REFUNDED';

  const razorpayPaymentId = claimed.gateway?.paymentId;
  const viaRazorpay = claimed.method === 'RAZORPAY' && razorpayPaymentId;

  if (viaRazorpay) {
    try {
      const response = await getRazorpay().payments.refund(razorpayPaymentId, {
        amount: toPaise(amount),
        notes: { reason: String(reason).slice(0, 250), khatuPaymentId: claimed.khatuPaymentId || String(claimed._id) },
      });
      Object.assign(refund, { status: 'RAZORPAY_REFUNDED', razorpayRefundId: response?.id });
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode >= 400 && statusCode < 500) {
        await User.findByIdAndUpdate(claimed.userId, { $inc: { walletBalance: amount } });
        Object.assign(refund, {
          status: 'WALLET_CREDITED',
          walletCreditedAt: new Date(),
          razorpayError: error?.error?.description || error.message,
        });
      } else {
        paymentStatus = 'CONFIRMED';
        Object.assign(refund, {
          status: 'REVIEW_REQUIRED',
          razorpayError: error?.error?.description || error.message || 'Razorpay refund did not respond',
        });
      }
    }
  } else {
    await User.findByIdAndUpdate(claimed.userId, { $inc: { walletBalance: amount } });
    Object.assign(refund, { status: 'WALLET_CREDITED', walletCreditedAt: new Date() });
  }

  await Payment.updateOne(
    { _id: claimed._id },
    { $set: { status: paymentStatus, 'metadata.refund': refund } }
  );

  emitToUser(claimed.userId, 'payment:status_updated', {
    paymentId: claimed._id,
    khatuPaymentId: claimed.khatuPaymentId,
    status: paymentStatus,
    type: claimed.type,
    amount,
    refund,
  });

  if (refund.status !== 'REVIEW_REQUIRED') {
    await notify(claimed.userId, 'service_refunded', {
      amount,
      payment: claimed,
      refundedToWallet: refund.status === 'WALLET_CREDITED',
      data: {
        paymentId: String(claimed._id),
        khatuPaymentId: claimed.khatuPaymentId,
        paymentType: claimed.type,
      },
    });
  }

  return refund;
}

export const refundRechargePayment = refundClubAPIPayment;

export async function refundUnprocessedServicePayment(payment, reason = 'Service could not be processed after payment') {
  return refundClubAPIPayment(payment, reason);
}

/* --------------------------------------------------------------- lifecycle */

async function createBbpsInvoice(transaction) {
  try {
    const amount = Number(transaction.amount || 0);
    const label = transaction.providerName || transaction.provider;
    await Invoice.create({
      invoiceNumber: `KPBBPS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`,
      userId: transaction.userId,
      amount,
      taxableAmount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      status: 'PAID',
      invoiceType: 'BBPS',
      description: `BBPS bill payment - ${label}`,
      notes: `Transaction ID: ${transaction.urid} | BBPS Order: ${transaction.orderId || '-'} | Account: ${transaction.accountRef}`,
      items: [{ description: `BBPS bill payment - ${label}`, quantity: 1, rate: amount, total: amount }],
    });
  } catch (error) {
    console.error('BBPS invoice creation failed:', error.message);
  }
}

/**
 * Moves a transaction to its final state once. Side effects (refund, invoice,
 * socket event) only run for the call that actually performed the transition.
 */
async function transitionTransaction(transaction, decision, { allowReversal = false } = {}) {
  const fromStatuses = allowReversal ? ['pending', 'processing', 'completed'] : ['pending', 'processing'];
  const set = {
    status: decision.localStatus,
    ...(decision.orderId ? { orderId: decision.orderId } : {}),
    ...(decision.operatorTxnId ? { operatorTxnId: decision.operatorTxnId } : {}),
    ...(decision.message ? { statusText: decision.message } : {}),
    ...(decision.localStatus === 'completed' ? { completedAt: new Date() } : {}),
  };

  // "Still pending" is not a transition: record the new details but never
  // touch the status, so a late PENDING can't downgrade a completed txn.
  if (decision.localStatus === 'processing') {
    const { status: _ignored, ...details } = set;
    if (!Object.keys(details).length) return ClubAPITransaction.findById(transaction._id);
    return ClubAPITransaction.findByIdAndUpdate(transaction._id, { $set: details }, { new: true });
  }

  const updated = await ClubAPITransaction.findOneAndUpdate(
    {
      _id: transaction._id,
      status: { $in: fromStatuses.filter((status) => status !== decision.localStatus) },
    },
    { $set: set },
    { new: true }
  );
  if (!updated) return ClubAPITransaction.findById(transaction._id);

  if (updated.paymentId) {
    await Payment.updateOne(
      { _id: updated.paymentId },
      {
        $set: {
          [`metadata.${updated.type === 'bill_payment' ? 'clubapiBill' : 'recharge'}.clubapiStatus`]: updated.status,
          [`metadata.${updated.type === 'bill_payment' ? 'clubapiBill' : 'recharge'}.orderId`]: updated.orderId || '',
        },
      }
    );
  }

  if (updated.status === 'failed' && decision.refund !== false && updated.paymentId) {
    const refund = await refundClubAPIPayment(
      updated.paymentId,
      decision.message ? `Operator failure: ${decision.message}` : 'Transaction failed at operator'
    );
    if (refund) {
      updated.refund = refund;
      await ClubAPITransaction.updateOne({ _id: updated._id }, { $set: { refund } });
    }
  }

  if (updated.status === 'completed' && updated.type === 'bill_payment' && updated.userId) {
    await createBbpsInvoice(updated);
  }

  // "Payment successful" is sent when the operator confirms, not when the
  // gateway does - otherwise a recharge that later fails would first be
  // announced as successful.
  if (updated.status === 'completed' && updated.paymentId && updated.userId) {
    const payment = await Payment.findById(updated.paymentId).lean();
    if (payment) {
      await notify(updated.userId, 'payment_confirmed', {
        amount: payment.amount,
        payment,
        data: {
          paymentId: String(payment._id),
          khatuPaymentId: payment.khatuPaymentId,
          paymentType: payment.type,
          urid: updated.urid,
        },
      });
    }
  }

  emitClubTransaction(updated.userId, updated);
  return updated;
}

/* ---------------------------------------------------------------- execution */

async function claimForProcessing(payment, transactionId, processedAtKey) {
  return Payment.findOneAndUpdate(
    { _id: payment._id, status: 'CONFIRMED', 'metadata.clubapiTransactionId': { $exists: false } },
    {
      $set: {
        'metadata.clubapiTransactionId': transactionId,
        [`metadata.${processedAtKey}`]: new Date(),
      },
    },
    { new: true }
  );
}

async function existingResult(payment) {
  const fresh = await Payment.findById(payment._id).lean();
  const transaction = fresh?.metadata?.clubapiTransactionId
    ? await ClubAPITransaction.findById(fresh.metadata.clubapiTransactionId)
    : null;
  return { transaction, refund: fresh?.metadata?.refund || null, reused: true };
}

/**
 * Sends a confirmed RECHARGE payment to ClubAPI. Safe to call repeatedly: the
 * second and later calls return the first attempt's transaction.
 */
export async function processPaidRecharge(payment) {
  if (!payment) throw new Error('Payment not found');
  if (payment.type !== 'RECHARGE') throw new Error('Payment is not a recharge payment');

  const transactionId = new mongoose.Types.ObjectId();
  const claimed = await claimForProcessing(payment, transactionId, 'rechargeProcessedAt');
  if (!claimed) return existingResult(payment);

  const meta = claimed.metadata?.recharge || {};
  const serviceKey = String(meta.type || '').toLowerCase();
  const amount = Number(claimed.amount || 0);
  const urid = generateURID();

  const missing = ['operatorId', 'accountRef'].find((field) => !meta[field]);
  const transaction = await ClubAPITransaction.create({
    _id: transactionId,
    urid,
    type: serviceKey === 'dth' ? 'dth' : 'mobile',
    serviceKey: serviceKey || 'mobile',
    status: 'processing',
    amount,
    provider: String(meta.operatorId || 'unknown'),
    providerId: mongoose.isValidObjectId(meta.providerId) ? meta.providerId : undefined,
    providerName: meta.operatorName,
    accountRef: String(meta.accountRef || 'unknown'),
    customerMobile: meta.customerMobile,
    request: {
      operatorId: meta.operatorId,
      mobile: meta.accountRef,
      amount: String(amount),
      customerMobile: meta.customerMobile,
    },
    userId: claimed.userId,
    paymentId: claimed._id,
  });
  await Payment.updateOne({ _id: claimed._id }, { $set: { 'metadata.recharge.urid': urid } });
  emitClubTransaction(claimed.userId, transaction);

  if (missing || !(amount > 0)) {
    const updated = await transitionTransaction(transaction, {
      localStatus: 'failed',
      refund: true,
      message: `Recharge ${missing || 'amount'} is missing`,
    });
    return { transaction: updated, refund: updated?.refund || null, error: updated?.statusText };
  }

  const outcome = await sendRecharge({
    urid,
    operatorId: meta.operatorId,
    mobile: meta.accountRef,
    amount,
    customerMobile: meta.customerMobile,
  });

  await ClubAPITransaction.updateOne(
    { _id: transaction._id },
    { $set: { response: outcome.data ?? { delivery: outcome.delivery, error: outcome.error } } }
  );

  const decision = decideTransactionOutcome(outcome);
  const updated = await transitionTransaction(transaction, decision);
  return { transaction: updated, refund: updated?.refund || null, response: outcome.data };
}

/**
 * Sends a confirmed BBPS_BILL payment to ClubAPI. Safe to call repeatedly.
 */
export async function processPaidBbpsBill(payment) {
  if (!payment) throw new Error('Payment not found');
  if (payment.type !== 'BBPS_BILL') throw new Error('Payment is not a BBPS bill payment');

  const transactionId = new mongoose.Types.ObjectId();
  const claimed = await claimForProcessing(payment, transactionId, 'billProcessedAt');
  if (!claimed) return existingResult(payment);

  const meta = claimed.metadata?.clubapiBill || {};
  const bbpsId = meta.bbpsId || meta.operatorId;
  const mobile = meta.mobile || meta.accountRef;
  const amount = Number(claimed.amount || 0);
  const urid = generateURID();
  const opvalues = Object.fromEntries(
    ['opvalue1', 'opvalue2', 'opvalue3', 'opvalue4', 'opvalue5']
      .filter((key) => meta[key])
      .map((key) => [key, meta[key]])
  );

  const transaction = await ClubAPITransaction.create({
    _id: transactionId,
    urid,
    type: 'bill_payment',
    serviceKey: meta.serviceKey,
    status: 'processing',
    amount,
    provider: String(bbpsId || 'unknown'),
    providerId: mongoose.isValidObjectId(meta.providerId) ? meta.providerId : undefined,
    providerName: meta.billerName,
    accountRef: String(mobile || 'unknown'),
    customerMobile: meta.customerMobile,
    billId: meta.fetchId || meta.billId,
    request: { bbpsId, mobile, customerMobile: meta.customerMobile, amount: String(amount), ...opvalues },
    userId: claimed.userId,
    paymentId: claimed._id,
  });
  await Payment.updateOne({ _id: claimed._id }, { $set: { 'metadata.clubapiBill.urid': urid } });
  emitClubTransaction(claimed.userId, transaction);

  const missing = [
    ['bbpsId', bbpsId],
    ['account', mobile],
    ['customerMobile', meta.customerMobile],
  ].find(([, value]) => !value);

  if (missing || !(amount > 0)) {
    const updated = await transitionTransaction(transaction, {
      localStatus: 'failed',
      refund: true,
      message: `Bill payment ${missing ? missing[0] : 'amount'} is missing`,
    });
    return { transaction: updated, refund: updated?.refund || null, error: updated?.statusText };
  }

  const outcome = await sendBillPayment({
    urid,
    bbpsId,
    mobile,
    customerMobile: meta.customerMobile,
    amount,
    opvalues,
  });

  await ClubAPITransaction.updateOne(
    { _id: transaction._id },
    { $set: { response: outcome.data ?? { delivery: outcome.delivery, error: outcome.error } } }
  );

  const decision = decideTransactionOutcome(outcome);
  const updated = await transitionTransaction(transaction, decision);
  return { transaction: updated, refund: updated?.refund || null, response: outcome.data };
}

/* ----------------------------------------------------------- status & sync */

/**
 * Asks ClubAPI for the real status of a pending transaction and applies it.
 * Throttled per transaction because ClubAPI disables accounts that poll hard.
 */
export async function syncTransactionStatus(transactionOrId, { force = false, allowReversal = false } = {}) {
  const transaction =
    transactionOrId instanceof ClubAPITransaction
      ? transactionOrId
      : await ClubAPITransaction.findById(transactionOrId?._id || transactionOrId);
  if (!transaction || !PAYABLE_TYPES.includes(transaction.type)) return transaction;

  const open = ['pending', 'processing'].includes(transaction.status);
  if (!open && !allowReversal) return transaction;

  const lastCheck = transaction.lastStatusCheckAt ? new Date(transaction.lastStatusCheckAt).getTime() : 0;
  if (!force && Date.now() - lastCheck < STATUS_CHECK_INTERVAL_MS) return transaction;

  // Claim the check so concurrent polls do not all call ClubAPI.
  const claimed = await ClubAPITransaction.findOneAndUpdate(
    {
      _id: transaction._id,
      $or: [
        { lastStatusCheckAt: { $exists: false } },
        { lastStatusCheckAt: { $lt: new Date(Date.now() - (force ? 2000 : STATUS_CHECK_INTERVAL_MS)) } },
      ],
    },
    { $set: { lastStatusCheckAt: new Date() }, $inc: { statusChecks: 1 } },
    { new: true }
  );
  if (!claimed) return transaction;

  const outcome = await sendStatusCheck({ urid: claimed.urid, orderId: claimed.orderId });
  if (outcome.delivery !== 'received') return claimed;

  const parsed = normalizeStatusCheckResponse(outcome.data);
  const age = Date.now() - new Date(claimed.createdAt).getTime();

  if (parsed.found) {
    const decision = {
      localStatus: toLocalStatus(parsed.status),
      refund: true,
      orderId: parsed.orderId,
      operatorTxnId: parsed.operatorTxnId,
      message: parsed.message,
    };
    if (decision.localStatus === claimed.status) {
      return ClubAPITransaction.findByIdAndUpdate(
        claimed._id,
        {
          $set: {
            ...(parsed.orderId ? { orderId: parsed.orderId } : {}),
            ...(parsed.operatorTxnId ? { operatorTxnId: parsed.operatorTxnId } : {}),
          },
        },
        { new: true }
      );
    }
    return transitionTransaction(claimed, decision, { allowReversal: allowReversal && decision.localStatus === 'failed' });
  }

  // ClubAPI: "No such order found" within an hour of the transaction means it
  // was never created, so it can be failed (and refunded). Older lookups may
  // just be archived and are left for manual review.
  if (parsed.notFound && open && age >= NOT_FOUND_MIN_AGE_MS && age <= NOT_FOUND_MAX_AGE_MS) {
    return transitionTransaction(claimed, {
      localStatus: 'failed',
      refund: true,
      message: parsed.message || 'Order was not created at the operator',
    });
  }

  if (parsed.notFound && open && age > NOT_FOUND_MAX_AGE_MS) {
    await ClubAPITransaction.updateOne(
      { _id: claimed._id },
      { $set: { statusText: 'Needs manual review: order not found at ClubAPI' } }
    );
  }

  return ClubAPITransaction.findById(claimed._id);
}

/**
 * Applies a ClubAPI callback. The callback endpoint is public, so its claimed
 * status is verified with the status API before anything is refunded.
 */
export async function applyClubapiCallback(payload = {}) {
  const urid = String(payload.urid || payload.ourSystemId || payload.ourSystemOrderId || '').trim();
  const orderId = String(payload.orderId || payload.order_id || payload.orderid || '').trim();
  if (!urid && !orderId) return { matched: false };

  const query = [];
  if (urid) query.push({ urid });
  if (orderId) query.push({ orderId }, { 'response.data.orderId': orderId });

  const transaction = await ClubAPITransaction.findOne({ $or: query, type: { $in: PAYABLE_TYPES } });
  if (!transaction) return { matched: false };

  await ClubAPITransaction.updateOne(
    { _id: transaction._id },
    {
      $set: {
        ...(orderId && !transaction.orderId ? { orderId } : {}),
        'response.lastCallback': payload,
        'response.lastCallbackAt': new Date(),
      },
    }
  );

  const refreshed = await ClubAPITransaction.findById(transaction._id);
  const verified = await syncTransactionStatus(refreshed, { force: true, allowReversal: true });

  // If ClubAPI's status API could not be reached, a claimed SUCCESS is still
  // applied (it moves no money); a claimed FAILURE waits for verification.
  if (
    verified &&
    ['pending', 'processing'].includes(verified.status) &&
    normalizeStatusWord(payload.status) === 'SUCCESS'
  ) {
    const completed = await transitionTransaction(verified, {
      localStatus: 'completed',
      orderId,
      operatorTxnId: String(payload.transId || payload.operatorId_txn || '').trim(),
      message: String(payload.resText || payload.message || '').trim(),
    });
    return { matched: true, status: completed?.status };
  }

  return { matched: true, status: verified?.status };
}

/** Kept for older imports; callbacks now verify through applyClubapiCallback. */
export async function handleRechargeCallbackRefund(transaction) {
  if (!transaction?.paymentId || transaction.status !== 'failed') return null;
  return refundClubAPIPayment(transaction.paymentId, 'ClubAPI transaction failed');
}

/* --------------------------------------------------------------- reconciler */

let reconcilerTimer = null;

/**
 * Periodically resolves transactions left pending (timeouts, missed callbacks)
 * so customers get their recharge confirmed - or their money back - even if
 * they never reopen the app.
 */
export function startServiceReconciler({ intervalMs = 2 * 60 * 1000 } = {}) {
  if (reconcilerTimer) return;

  const run = async () => {
    try {
      const now = Date.now();
      const due = await ClubAPITransaction.find({
        type: { $in: PAYABLE_TYPES },
        status: { $in: ['pending', 'processing'] },
        createdAt: { $lt: new Date(now - 90 * 1000), $gt: new Date(now - 3 * 24 * 60 * 60 * 1000) },
      })
        .sort({ lastStatusCheckAt: 1 })
        .limit(15);

      for (const transaction of due) {
        await syncTransactionStatus(transaction);
      }
    } catch (error) {
      console.error('Service reconciler error:', error.message);
    }
  };

  reconcilerTimer = setInterval(run, intervalMs);
  reconcilerTimer.unref?.();
}

/* ------------------------------------------------------------- orchestration */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a confirmed service payment, waiting at most `waitMs` for the operator.
 *
 * The app's HTTP client gives up after 20s and ClubAPI can take longer, so the
 * verify/wallet endpoints must not block on the operator: if it is slow the
 * customer immediately gets a PENDING transaction (with its urid) to track,
 * and the work finishes in the background.
 */
export async function runServicePayment(payment, { waitMs = 8000 } = {}) {
  if (!payment || !['RECHARGE', 'BBPS_BILL'].includes(payment.type)) {
    return { transaction: null, refund: null };
  }

  const work = (payment.type === 'RECHARGE' ? processPaidRecharge(payment) : processPaidBbpsBill(payment)).catch(
    async (error) => {
      console.error(`Service payment ${payment._id} failed to start:`, error.message);
      // Only refund if nothing was ever handed to ClubAPI for this payment.
      const started = await ClubAPITransaction.exists({ paymentId: payment._id });
      const refund = started ? null : await refundClubAPIPayment(payment._id, 'Service could not be started');
      return { transaction: null, refund, error: error.message };
    }
  );

  const settled = waitMs > 0 ? await Promise.race([work, sleep(waitMs).then(() => null)]) : null;
  if (settled) return settled;

  const fresh = await Payment.findById(payment._id).select('metadata.clubapiTransactionId metadata.refund').lean();
  const transaction = fresh?.metadata?.clubapiTransactionId
    ? await ClubAPITransaction.findById(fresh.metadata.clubapiTransactionId)
    : await ClubAPITransaction.findOne({ paymentId: payment._id });
  return { transaction, refund: fresh?.metadata?.refund || null, pending: true };
}
