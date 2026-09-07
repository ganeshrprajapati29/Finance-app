// src/routes/payments.js
import express from 'express';
import crypto from 'crypto';
import Joi from 'joi';
import Payment from '../models/Payment.js';
import Loan from '../models/Loan.js';
import Bill from '../models/Bill.js';
import User from '../models/User.js';
import QRStickerOrder from '../models/QRStickerOrder.js';
import PaymentChatMessage from '../models/PaymentChatMessage.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { ok, fail } from '../utils/response.js';
import { applyPaymentToSchedule, isScheduleFullyPaid } from '../utils/loanSettlement.js';
import {
  getRazorpay,
  razorpayKeyId,
  razorpayKeySecret,
  requireWebhookSecret,
  toPaise,
} from '../services/razorpay.js';
import fraudCheck from '../middlewares/fraudCheck.js';
import { emitToUser } from '../realtime.js';
import { ensurePaymentInvoice } from '../services/paymentInvoiceService.js';
import { notifyUserSmart } from '../services/smartNotifications.js';
import { processPaidBbpsBill, processPaidRecharge, refundUnprocessedServicePayment } from '../services/rechargePaymentService.js';

const router = express.Router();

const rechargeSchema = Joi.object({
  type: Joi.string().valid('mobile', 'dth').required(),
  operatorId: Joi.string().required(),
  accountRef: Joi.string().required(),
  customerMobile: Joi.string().allow('', null),
  cbId: Joi.string().allow('', null),
  opvalue1: Joi.string().allow('', null),
  opvalue2: Joi.string().allow('', null),
  opvalue3: Joi.string().allow('', null),
  opvalue4: Joi.string().allow('', null),
  opvalue5: Joi.string().allow('', null)
});

const clubapiBillSchema = Joi.object({
  billId: Joi.string().allow('', null),
  operatorId: Joi.string().required(),
  bbpsId: Joi.string().allow('', null),
  accountRef: Joi.string().required(),
  mobile: Joi.string().allow('', null),
  customerMobile: Joi.string().pattern(/^\d{10}$/).required(),
  opvalue1: Joi.string().allow('', null),
  opvalue2: Joi.string().allow('', null),
  opvalue3: Joi.string().allow('', null),
  opvalue4: Joi.string().allow('', null),
  opvalue5: Joi.string().allow('', null)
});

function serviceLabel(type) {
  return type === 'RECHARGE' ? 'recharge' : 'bill payment';
}

/**
 * Constant-time signature comparison. A plain `!==` on hex digests leaks
 * timing information an attacker can use to forge a signature byte by byte.
 */
function signatureMatches(expected, received) {
  const expectedBuf = Buffer.from(String(expected || ''), 'utf8');
  const receivedBuf = Buffer.from(String(received || ''), 'utf8');
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Marks a payment CONFIRMED and runs every downstream side effect exactly
 * once.
 *
 * Razorpay tells us about a successful payment twice: through the client
 * callback (`/razorpay/verify`) and through the webhook. Both can also be
 * replayed. The `findOneAndUpdate` below is the idempotency gate - it is a
 * single atomic operation that only one caller can win, so the wallet is
 * credited once, an EMI is marked paid once, and a recharge is fired once, no
 * matter how many times this is called or how closely the two calls race.
 *
 * Callers that lose the race still get the confirmed payment back (with
 * `wasConfirmed: true`) so they can respond with success rather than an error.
 */
async function completeConfirmedPayment(p, gatewayPaymentId = '') {
  const resolvedPaymentId = gatewayPaymentId || p.gateway?.paymentId || '';

  const claimed = await Payment.findOneAndUpdate(
    { _id: p._id, status: { $ne: 'CONFIRMED' } },
    {
      $set: {
        status: 'CONFIRMED',
        'gateway.provider': p.gateway?.provider || 'razorpay',
        'gateway.orderId': p.gateway?.orderId || '',
        'gateway.paymentId': resolvedPaymentId,
      },
    },
    { new: true }
  );

  // Lost the race (or a replay): another call already confirmed this payment
  // and ran the side effects. Return the current state without repeating any
  // of them.
  if (!claimed) {
    const current = await Payment.findById(p._id);
    if (current && resolvedPaymentId && !current.gateway?.paymentId) {
      current.gateway = { ...(current.gateway || {}), paymentId: resolvedPaymentId };
      await current.save();
    }
    return { payment: current || p, clubapi: null, wasConfirmed: true };
  }

  p = claimed;
  const wasConfirmed = false;

  if (p.type === 'WALLET_TOPUP') {
    await User.findByIdAndUpdate(p.userId, { $inc: { walletBalance: p.amount } });
  }

  let clubapiResult = null;
  if (['RECHARGE', 'BBPS_BILL'].includes(p.type)) {
    try {
      clubapiResult = p.type === 'RECHARGE'
        ? await processPaidRecharge(p)
        : await processPaidBbpsBill(p);
    } catch (error) {
      const refund = await refundUnprocessedServicePayment(
        p,
        error.message || `${serviceLabel(p.type)} could not be processed`
      );
      clubapiResult = { transaction: null, refund, error: error.message };
    }
  }

  if (p.metadata?.stickerOrderId) {
    await QRStickerOrder.findByIdAndUpdate(p.metadata.stickerOrderId, {
      paymentStatus: 'PAID',
      orderStatus: 'CONFIRMED',
      razorpayPaymentId: gatewayPaymentId || p.gateway?.paymentId
    });
  }

  const chatMessage = await PaymentChatMessage.findOneAndUpdate(
    { paymentId: p._id },
    { paymentStatus: 'CONFIRMED', khatuPaymentId: p.khatuPaymentId },
    { new: true }
  );
  if (chatMessage) {
    emitToUser(chatMessage.senderId, 'payment_chat:payment_updated', chatMessage);
    emitToUser(chatMessage.receiverId, 'payment_chat:payment_updated', chatMessage);
  }

  if (p.loanId) {
    const loan = await Loan.findById(p.loanId);
    if (loan) {
      applyPaymentToSchedule(loan.schedule, {
        type: p.type,
        installmentNo: p.installmentNo,
        paymentId: p._id,
      });

      // Close the loan as soon as every installment is settled, whichever
      // route got it there - a final EMI closes the loan just like an explicit
      // foreclosure does.
      if (isScheduleFullyPaid(loan.schedule)) {
        loan.status = 'CLOSED';
      }

      await loan.save();
    }
  } else if (p.billId) {
    const bill = await Bill.findById(p.billId);
    if (bill) {
      bill.status = 'PAID';
      bill.paidAt = new Date();
      await bill.save();
    }
  }

  await ensurePaymentInvoice(p);

  // Reached only on the winning claim, so each notification fires once.
  if (clubapiResult?.refund) {
    await notifyUserSmart(p.userId, 'service_refunded', {
      amount: p.amount,
      payment: p,
      refundedToWallet: clubapiResult.refund?.status === 'WALLET_CREDITED',
      data: {
        paymentId: String(p._id),
        khatuPaymentId: p.khatuPaymentId,
        paymentType: p.type,
      },
    });
  } else {
    await notifyUserSmart(p.userId, 'payment_confirmed', {
      amount: p.amount,
      payment: p,
      data: {
        paymentId: String(p._id),
        khatuPaymentId: p.khatuPaymentId,
        paymentType: p.type,
      },
    });

    if (p.type === 'P2P' && p.payeeUserId) {
      const sender = await User.findById(p.userId).select('name');
      await notifyUserSmart(p.payeeUserId, 'money_received', {
        amount: p.amount,
        senderName: sender?.name,
        payment: p,
        data: {
          paymentId: String(p._id),
          khatuPaymentId: p.khatuPaymentId,
          paymentType: p.type,
        },
      });
    }
  }

  return { payment: p, clubapi: clubapiResult, wasConfirmed };
}

function paymentStatusPayload(payment) {
  return {
    paymentId: payment._id,
    khatuPaymentId: payment.khatuPaymentId,
    status: payment.status,
    amount: payment.amount,
    gateway: payment.gateway,
    serviceStatus: payment.metadata?.recharge?.clubapiStatus || payment.metadata?.clubapiBill?.clubapiStatus || null,
    clubapiTransactionId: payment.metadata?.clubapiTransactionId || null,
    refund: payment.metadata?.refund || null
  };
}

// 1) Create Razorpay Order (loan repayment / bill payment / P2P payment / generic)
router.post('/razorpay/order', requireAuth, fraudCheck, async (req, res, next) => {
  try {
    const { amount, currency = 'INR', loanId = null, billId = null, installmentNo = null, isFullPayment = false, walletTopup = false, recharge = null, clubapiBill = null, notes = {}, payeeUserId = null, payeeVPA = null, payeeName = null, payeeMobile = null, payeeNote = null } =
      await Joi.object({
        amount: Joi.number().min(1).max(100000).required(),
        currency: Joi.string().default('INR'),
        loanId: Joi.string().allow(null, '').default(null),
        billId: Joi.string().allow(null, '').default(null),
        installmentNo: Joi.number().integer().allow(null).default(null),
        isFullPayment: Joi.boolean().default(false),
        walletTopup: Joi.boolean().default(false),
        recharge: rechargeSchema.allow(null).default(null),
        clubapiBill: clubapiBillSchema.allow(null).default(null),
        notes: Joi.object().default({}),
        payeeUserId: Joi.string().allow(null, '').default(null),
        payeeVPA: Joi.string().allow(null, '').default(null),
        payeeName: Joi.string().allow(null, '').default(null),
        payeeMobile: Joi.string().allow(null, '').default(null),
        payeeNote: Joi.string().allow(null, '').default(null)
      }).validateAsync(req.body);

    // Loan repayment amounts must come from the loan's own schedule, never
    // from the client - otherwise a modified client (or a MITM'd request,
    // absent finding 3.1/3.2's cleartext+no-pinning fix) could close out a
    // loan for far less than actually owed. Every other payment type here
    // (wallet top-up, P2P, recharge, bill) is legitimately a user-chosen
    // amount, so only the loan path is re-derived server-side.
    let payableAmount = amount;
    if (loanId) {
      const loan = await Loan.findOne({ _id: loanId, userId: req.user.uid });
      if (!loan) return fail(res, 'LOAN_NOT_FOUND', 'Loan not found', 404);
      const schedule = Array.isArray(loan.schedule) ? loan.schedule : [];

      if (isFullPayment) {
        payableAmount = schedule.reduce(
          (sum, item) => sum + (item.paid ? 0 : Number(item.total || 0)), 0);
      } else if (installmentNo != null) {
        const sched = schedule.find((item) => item.installmentNo === installmentNo);
        if (!sched) return fail(res, 'INSTALLMENT_NOT_FOUND', 'Installment not found', 404);
        if (sched.paid) return fail(res, 'INSTALLMENT_ALREADY_PAID', 'This installment is already paid', 400);
        payableAmount = Number(sched.total || 0);
      } else {
        const sched = schedule.find((item) => !item.paid);
        if (!sched) return fail(res, 'LOAN_ALREADY_PAID', 'This loan has no outstanding balance', 400);
        payableAmount = Number(sched.total || 0);
      }

      if (!(payableAmount > 0)) {
        return fail(res, 'LOAN_ALREADY_PAID', 'This loan has no outstanding balance', 400);
      }
    }

    // Throws a clean 503 (never a 500 with gateway internals) when the
    // Razorpay credentials are not configured on this deployment.
    const rz = getRazorpay();
    const receipt = `KP-${Date.now()}`;
    const order = await rz.orders.create({
      // Rupees -> integer paise. Math.round avoids float drift turning
      // 1234.56 into 123455 paise.
      amount: toPaise(payableAmount),
      currency,
      receipt,
      notes
    });

    const type = recharge ? 'RECHARGE' : (clubapiBill ? 'BBPS_BILL' : (walletTopup ? 'WALLET_TOPUP' : (isFullPayment ? 'FULL_REPAYMENT' : (loanId ? 'REPAYMENT' : (billId ? 'BILL' : (payeeVPA ? 'P2P' : 'OTHER'))))));
    const payment = await Payment.create({
      userId: req.user.uid,
      loanId,
      billId,
      installmentNo,
      type,
      amount: payableAmount,
      method: 'RAZORPAY',
      reference: order.id,
      status: 'PENDING',
      gateway: { provider: 'razorpay', orderId: order.id },
      payeeUserId: payeeUserId || undefined,
      payeeDetails: payeeVPA ? { vpa: payeeVPA, name: payeeName, mobile: payeeMobile, note: payeeNote } : undefined,
      metadata: recharge ? {
        notes: notes?.purpose || 'recharge_payment',
        recharge: { ...recharge, amount }
      } : (clubapiBill ? {
        notes: notes?.purpose || 'bbps_bill_payment',
        clubapiBill: {
          ...clubapiBill,
          bbpsId: clubapiBill.bbpsId || clubapiBill.operatorId,
          mobile: clubapiBill.mobile || clubapiBill.accountRef,
          amount
        }
      } : { notes: notes?.purpose || notes?.note || '' })
    });

    ok(
      res,
      {
        order,
        paymentId: payment._id,
        khatuPaymentId: payment.khatuPaymentId,
        amount: payableAmount,
        currency,
        // Public key only. The secret never leaves the server.
        key_id: razorpayKeyId(),
      },
      'Order created',
      { code: 'ORDER_CREATED' }
    );
  } catch (e) { next(e); }
});

// 2) Client callback verify (after Checkout success)
router.post('/razorpay/verify', requireAuth, async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      await Joi.object({
        razorpay_order_id: Joi.string().required(),
        razorpay_payment_id: Joi.string().required(),
        razorpay_signature: Joi.string().required()
      }).validateAsync(req.body);

    // Razorpay's documented callback signature: HMAC-SHA256 over
    // "<order_id>|<payment_id>" keyed with the API secret. This is the only
    // place the app's claim of success is actually trusted - the Flutter
    // client never verifies a signature itself.
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', razorpayKeySecret())
      .update(body)
      .digest('hex');

    if (!signatureMatches(expected, razorpay_signature)) {
      return fail(res, 'BAD_SIGNATURE', 'This payment could not be verified.', 400);
    }

    const p = await Payment.findOne({ 'gateway.orderId': razorpay_order_id });
    if (!p) return fail(res, 'PAYMENT_NOT_FOUND', 'Payment not found', 404);

    const { payment, clubapi: clubapiResult, wasConfirmed } =
      await completeConfirmedPayment(p, razorpay_payment_id);

    ok(
      res,
      {
        verified: true,
        // True when the webhook (or a retry of this call) already confirmed
        // it. Still a success for the client; nothing was double-applied.
        alreadyConfirmed: wasConfirmed,
        paymentId: payment._id,
        khatuPaymentId: payment.khatuPaymentId,
        status: payment.status,
        recharge: clubapiResult,
        clubapi: clubapiResult,
      },
      'Payment verified',
      { code: 'PAYMENT_VERIFIED' }
    );
  } catch (e) { next(e); }
});

router.post('/wallet/pay', requireAuth, async (req, res, next) => {
  try {
    const { amount, type = 'OTHER', billId = null, note = '' } = await Joi.object({
      amount: Joi.number().min(1).max(100000).required(),
      type: Joi.string().allow('', null).default('OTHER'),
      billId: Joi.string().allow('', null).default(null),
      note: Joi.string().allow('', null).default('')
    }).validateAsync(req.body);

    const user = await User.findById(req.user.uid);
    if (!user) return fail(res, 'NOT_FOUND', 'User not found', 404);
    if ((user.walletBalance || 0) < amount) {
      return fail(res, 'INSUFFICIENT_WALLET', 'Wallet balance is not enough. Please add money first.', 400);
    }

    user.walletBalance = (user.walletBalance || 0) - amount;
    await user.save();

    if (billId) {
      const bill = await Bill.findById(billId);
      if (bill) {
        bill.status = 'PAID';
        bill.paidAt = new Date();
        await bill.save();
      }
    }

    const payment = await Payment.create({
      userId: req.user.uid,
      billId: billId || undefined,
      type: 'WALLET_SPEND',
      amount,
      method: 'WALLET',
      reference: `WALLET-${Date.now()}`,
      status: 'CONFIRMED',
      metadata: { notes: note || `Wallet payment for ${type}`, paymentDate: new Date() }
    });
    await ensurePaymentInvoice(payment);

    await notifyUserSmart(req.user.uid, 'payment_confirmed', {
      amount,
      payment,
      data: {
        paymentId: String(payment._id),
        khatuPaymentId: payment.khatuPaymentId,
        paymentType: payment.type,
      },
    });

    ok(res, { payment, walletBalance: user.walletBalance }, 'Wallet payment successful');
  } catch (e) { next(e); }
});

// Pay a mobile/DTH recharge or a BBPS bill straight from wallet balance (no Razorpay hop)
router.post('/wallet/service', requireAuth, fraudCheck, async (req, res, next) => {
  try {
    const { amount, recharge, clubapiBill } = await Joi.object({
      amount: Joi.number().min(1).max(100000).required(),
      recharge: rechargeSchema.allow(null).default(null),
      clubapiBill: clubapiBillSchema.allow(null).default(null)
    }).validateAsync(req.body);

    if (!recharge && !clubapiBill) {
      return fail(res, 'SERVICE_DETAILS_REQUIRED', 'Recharge or bill details are required.', 400);
    }

    const user = await User.findById(req.user.uid);
    if (!user) return fail(res, 'NOT_FOUND', 'User not found', 404);
    if ((user.walletBalance || 0) < amount) {
      return fail(res, 'INSUFFICIENT_WALLET', 'Wallet balance is not enough. Please add money or pay with Razorpay instead.', 400);
    }

    user.walletBalance = (user.walletBalance || 0) - amount;
    await user.save();

    const type = recharge ? 'RECHARGE' : 'BBPS_BILL';
    const payment = await Payment.create({
      userId: req.user.uid,
      type,
      amount,
      method: 'WALLET',
      reference: `WALLET-${Date.now()}`,
      status: 'CONFIRMED',
      metadata: recharge ? {
        notes: 'recharge_payment',
        recharge: { ...recharge, amount }
      } : {
        notes: 'bbps_bill_payment',
        clubapiBill: {
          ...clubapiBill,
          bbpsId: clubapiBill.bbpsId || clubapiBill.operatorId,
          mobile: clubapiBill.mobile || clubapiBill.accountRef,
          amount
        }
      }
    });

    let clubapiResult;
    try {
      clubapiResult = type === 'RECHARGE'
        ? await processPaidRecharge(payment)
        : await processPaidBbpsBill(payment);
    } catch (error) {
      // processPaidRecharge/processPaidBbpsBill refund internally on ClubAPI failure;
      // this only guards the rare case where they throw before that (e.g. bad metadata).
      await User.findByIdAndUpdate(req.user.uid, { $inc: { walletBalance: amount } });
      throw error;
    }

    await ensurePaymentInvoice(payment);
    const refreshedUser = await User.findById(req.user.uid).select('walletBalance');

    await notifyUserSmart(req.user.uid, 'payment_confirmed', {
      amount,
      payment,
      data: {
        paymentId: String(payment._id),
        khatuPaymentId: payment.khatuPaymentId,
        paymentType: payment.type,
      },
    });

    if (clubapiResult?.transaction?.status === 'failed') {
      await notifyUserSmart(req.user.uid, 'service_refunded', {
        amount,
        payment,
        refundedToWallet: true,
        data: {
          paymentId: String(payment._id),
          khatuPaymentId: payment.khatuPaymentId,
          paymentType: payment.type,
        },
      });
    }

    ok(res, {
      payment,
      walletBalance: refreshedUser?.walletBalance ?? user.walletBalance,
      clubapi: clubapiResult
    }, `Wallet ${serviceLabel(type)} request processed`);
  } catch (e) { next(e); }
});

// 3) Razorpay Webhook (RAW BODY required)
router.post(
  '/razorpay/webhook',
  // IMPORTANT: use raw body for correct signature verification
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      let secret;
      try {
        secret = requireWebhookSecret();
      } catch {
        return res.status(503).json({
          success: false,
          message: 'Webhook is not configured.',
          data: null,
          code: 'WEBHOOK_UNCONFIGURED',
        });
      }

      const signature = req.headers['x-razorpay-signature'];

      // Signature must be computed over the exact bytes Razorpay sent.
      // `express.json`'s verify hook stashes them on req.rawBody; the
      // express.raw() on this route is the fallback. Re-serialising a parsed
      // body would change key order/whitespace and break verification.
      const rawBody =
        req.rawBody || (Buffer.isBuffer(req.body) ? req.body : null);

      if (!rawBody) {
        console.error('Razorpay webhook: raw body unavailable, cannot verify');
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook payload.',
          data: null,
          code: 'WEBHOOK_RAW_BODY_MISSING',
        });
      }

      const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      if (!signatureMatches(expected, signature)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid signature.',
          data: null,
          code: 'BAD_SIGNATURE',
        });
      }

      const event = JSON.parse(rawBody.toString('utf8'));

      if (event.event === 'order.paid' || event.event === 'payment.captured') {
        const orderId =
          event.payload?.payment?.entity?.order_id ||
          event.payload?.order?.entity?.id;
        const paymentId = event.payload?.payment?.entity?.id;

        const p = await Payment.findOne({ 'gateway.orderId': orderId });
        if (p) {
          await completeConfirmedPayment(p, paymentId);
        }
      }

      if (event.event === 'payment.failed') {
        const entity = event.payload?.payment?.entity || {};
        const orderId = entity.order_id;
        const paymentId = entity.id;
        const existing = await Payment.findOne({ 'gateway.orderId': orderId });

        if (existing) {
          const failureMeta = {
            ...(existing.metadata?.toObject?.() || existing.metadata || {}),
            razorpayFailure: {
              code: entity.error_code || '',
              description: entity.error_description || '',
              source: entity.error_source || '',
              step: entity.error_step || '',
              reason: entity.error_reason || '',
              failedAt: new Date(),
            },
          };

          // Atomic PENDING -> FAILED. The status filter is what stops a late
          // `payment.failed` from overwriting a payment that a callback or
          // `payment.captured` already confirmed, and stops a duplicate
          // delivery from re-notifying the user.
          const p = await Payment.findOneAndUpdate(
            { _id: existing._id, status: 'PENDING' },
            {
              $set: {
                status: 'FAILED',
                'gateway.paymentId': paymentId || existing.gateway?.paymentId || '',
                metadata: failureMeta,
              },
            },
            { new: true }
          );

          if (p) {
            await notifyUserSmart(p.userId, 'payment_failed', {
              amount: p.amount,
              payment: p,
              data: {
                paymentId: String(p._id),
                khatuPaymentId: p.khatuPaymentId,
                paymentType: p.type,
              },
            });
          }
        }
      }

      if (event.event === 'refund.processed') {
        const entity = event.payload?.refund?.entity || {};
        const paymentId = entity.payment_id;
        const p = await Payment.findOne({ 'gateway.paymentId': paymentId });
        if (p) {
          p.status = 'REFUNDED';
          p.metadata = {
            ...(p.metadata?.toObject?.() || p.metadata || {}),
            razorpayRefund: {
              id: entity.id || '',
              amount: Number(entity.amount || 0) / 100,
              status: entity.status || 'processed',
              processedAt: new Date(),
            },
          };
          await p.save();
        }
      }

      return res.json({
        success: true,
        message: 'Webhook processed',
        data: null,
      });
    } catch (e) {
      // Logged server-side with full detail; the response stays generic so a
      // webhook reply never leaks internals. A 500 makes Razorpay retry,
      // which is safe because completeConfirmedPayment is idempotent.
      console.error('Razorpay webhook error', e);
      return res.status(500).json({
        success: false,
        message: 'Webhook could not be processed.',
        data: null,
        code: 'WEBHOOK_ERROR',
      });
    }
  }
);

router.post('/status', requireAuth, async (req, res, next) => {
  try {
    const { orderId } = await Joi.object({
      orderId: Joi.string().required()
    }).validateAsync(req.body);

    const payment = await Payment.findOne({
      userId: req.user.uid,
      $or: [
        { khatuPaymentId: orderId },
        { reference: orderId },
        { 'gateway.orderId': orderId },
        { 'gateway.paymentId': orderId },
      ]
    });
    if (!payment) return fail(res, 'NOT_FOUND', 'Payment not found', 404);
    ok(res, paymentStatusPayload(payment));
  } catch (e) { next(e); }
});

// 4) My payments (user)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await Payment.find({ userId: req.user.uid }).sort({ createdAt: -1 });
    ok(res, rows);
  } catch (e) { next(e); }
});

// 5) Manual confirm (admin/finance)
router.put('/:id/confirm', requireAuth, requireRole(['admin', 'finance']), async (req, res, next) => {
  try {
    const p = await Payment.findById(req.params.id);
    if (!p) return fail(res, 'NOT_FOUND', 'Payment not found', 404);
    p.status = 'CONFIRMED';
    await p.save();
    await ensurePaymentInvoice(p);
    ok(res, p, 'Payment confirmed');
  } catch (e) { next(e); }
});

export default router;
