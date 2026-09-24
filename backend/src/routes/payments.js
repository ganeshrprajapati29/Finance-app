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
import ClubAPITransaction from '../models/ClubAPITransaction.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { ok, fail } from '../utils/response.js';
import { applyPaymentToSchedule, isScheduleFullyPaid } from '../utils/loanSettlement.js';
import {
  createRazorpayOrder,
  razorpayKeyId,
  razorpayKeySecret,
  requireWebhookSecret,
  razorpayRefundState,
  toPaise,
} from '../services/razorpay.js';
import fraudCheck from '../middlewares/fraudCheck.js';
import { emitToUser } from '../realtime.js';
import { ensurePaymentInvoice } from '../services/paymentInvoiceService.js';
import { notifyUserSmart } from '../services/smartNotifications.js';
import { runServicePayment } from '../services/rechargePaymentService.js';
import { ServiceError } from '../services/serviceCatalogService.js';
import {
  publicServiceTransaction,
  resolveLegacyServicePayment,
  resolveServicePayment,
} from '../services/servicePaymentService.js';

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

/**
 * Recharge / bill payment request from the app. Only identifiers and the
 * amount come from the client; operator ids, biller ids, account values and
 * amount limits are resolved on the server (servicePaymentService.js).
 */
const serviceSchema = Joi.object({
  key: Joi.string().valid('mobile', 'dth', 'credit_card', 'electricity', 'fastag').required(),
  providerId: Joi.string().trim().required(),
  amount: Joi.number().positive().max(100000).required(),
  accountNumber: Joi.string().trim().max(64).allow('', null),
  fetchId: Joi.string().trim().max(40).allow('', null),
  customerMobile: Joi.string().trim().allow('', null),
  fields: Joi.object().pattern(/^(mobile|opvalue[1-5])$/, Joi.string().allow('').max(64)).allow(null),
});

/**
 * Resolves a service payment (new `service` payload or the legacy
 * `recharge` / `clubapiBill` shapes) into a server-verified amount, payment
 * type and metadata. Returns null when the request is not a service payment.
 */
async function resolveServiceRequest({ userId, service, recharge, clubapiBill, amount }) {
  if (service) return resolveServicePayment({ userId, service });
  if (recharge || clubapiBill) return resolveLegacyServicePayment({ userId, recharge, clubapiBill, amount });
  return null;
}

function sendServiceError(res, error) {
  return fail(res, error.code, error.message, error.status, error.data);
}

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
async function completeConfirmedPayment(p, gatewayPaymentId = '', { serviceWaitMs = 8000 } = {}) {
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
    // The winner (usually the webhook) may have started the recharge / bill in
    // the background. runServicePayment is idempotent, so this just returns
    // that transaction for the app to track - or starts it if it never began.
    const clubapi =
      current && current.status === 'CONFIRMED' && ['RECHARGE', 'BBPS_BILL'].includes(current.type)
        ? await runServicePayment(current, { waitMs: serviceWaitMs })
        : null;
    return { payment: current || p, clubapi, wasConfirmed: true };
  }

  p = claimed;
  const wasConfirmed = false;

  if (p.type === 'WALLET_TOPUP') {
    await User.findByIdAndUpdate(p.userId, { $inc: { walletBalance: p.amount } });
  }

  // Recharges and bill payments go to ClubAPI. runServicePayment never blocks
  // longer than serviceWaitMs and handles its own refunds and notifications.
  let clubapiResult = null;
  if (['RECHARGE', 'BBPS_BILL'].includes(p.type)) {
    clubapiResult = await runServicePayment(p, { waitMs: serviceWaitMs });
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
  // Recharges and bill payments notify from the service layer when the
  // operator confirms (or refund), not when the gateway does.
  if (!['RECHARGE', 'BBPS_BILL'].includes(p.type)) {
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
    // Recharge / bill reference the app tracks via /api/services/transactions/:urid
    serviceUrid: payment.metadata?.recharge?.urid || payment.metadata?.clubapiBill?.urid || null,
    refund: payment.metadata?.refund || null
  };
}

// 1) Create Razorpay Order (loan repayment / bill payment / P2P payment / generic)
router.post('/razorpay/order', requireAuth, fraudCheck, async (req, res, next) => {
  try {
    const { amount, currency = 'INR', loanId = null, billId = null, installmentNo = null, isFullPayment = false, walletTopup = false, recharge = null, clubapiBill = null, service = null, notes = {}, payeeUserId = null, payeeVPA = null, payeeName = null, payeeMobile = null, payeeNote = null } =
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
        service: serviceSchema.allow(null).default(null),
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

    // Recharges and bill payments: amount, operator and biller are all
    // re-derived server-side. The client amount must match what was resolved.
    let serviceResolution = null;
    try {
      serviceResolution = await resolveServiceRequest({
        userId: req.user.uid,
        service,
        recharge,
        clubapiBill,
        amount,
      });
    } catch (error) {
      if (error instanceof ServiceError) return sendServiceError(res, error);
      throw error;
    }
    if (serviceResolution) {
      if (Math.abs(Number(amount) - serviceResolution.amount) > 0.009) {
        return fail(res, 'AMOUNT_MISMATCH', 'The amount changed. Please review and try again.', 400);
      }
      payableAmount = serviceResolution.amount;
    }

    // Throws a clean 503 when Razorpay is not configured, and a 502 carrying
    // Razorpay's own reason when it rejects the order (bad keys, account not
    // activated...) - never an opaque "Something went wrong".
    const receipt = `KP-${Date.now()}`;
    const order = await createRazorpayOrder({
      // Rupees -> integer paise. Math.round avoids float drift turning
      // 1234.56 into 123455 paise.
      amount: toPaise(payableAmount),
      currency,
      receipt,
      notes
    });

    const type = serviceResolution ? serviceResolution.paymentType : (walletTopup ? 'WALLET_TOPUP' : (isFullPayment ? 'FULL_REPAYMENT' : (loanId ? 'REPAYMENT' : (billId ? 'BILL' : (payeeVPA ? 'P2P' : 'OTHER')))));
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
      metadata: serviceResolution
        ? serviceResolution.metadata
        : { notes: notes?.purpose || notes?.note || '' }
    });

    ok(
      res,
      {
        order,
        paymentId: payment._id,
        khatuPaymentId: payment.khatuPaymentId,
        amount: payableAmount,
        currency,
        service: serviceResolution?.summary || null,
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

    // The callback belongs to the signed-in customer who created the order.
    // The Razorpay signature proves the gateway response; this ownership
    // condition additionally prevents one account from confirming another
    // account's payment if callback values are ever exposed or replayed.
    const p = await Payment.findOne({
      userId: req.user.uid,
      'gateway.orderId': razorpay_order_id,
    });
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
        // The recharge / bill transaction to track (null for other payments).
        service:
          publicServiceTransaction(
            clubapiResult?.transaction ||
              (['RECHARGE', 'BBPS_BILL'].includes(payment.type)
                ? await ClubAPITransaction.findOne({ paymentId: payment._id })
                : null)
          ) || null,
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
    const { amount, recharge, clubapiBill, service } = await Joi.object({
      amount: Joi.number().min(1).max(100000).required(),
      recharge: rechargeSchema.allow(null).default(null),
      clubapiBill: clubapiBillSchema.allow(null).default(null),
      service: serviceSchema.allow(null).default(null)
    }).validateAsync(req.body);

    let resolution;
    try {
      resolution = await resolveServiceRequest({
        userId: req.user.uid,
        service,
        recharge,
        clubapiBill,
        amount,
      });
    } catch (error) {
      if (error instanceof ServiceError) return sendServiceError(res, error);
      throw error;
    }
    if (!resolution) {
      return fail(res, 'SERVICE_DETAILS_REQUIRED', 'Recharge or bill details are required.', 400);
    }
    if (Math.abs(Number(amount) - resolution.amount) > 0.009) {
      return fail(res, 'AMOUNT_MISMATCH', 'The amount changed. Please review and try again.', 400);
    }
    const rechargeType = String(resolution.metadata?.recharge?.type || '').toLowerCase();
    if (['mobile', 'dth'].includes(rechargeType)) {
      return fail(
        res,
        'WALLET_DISABLED_FOR_RECHARGE',
        'Wallet payment is not available for recharge. Please pay with UPI, card or net banking.',
        400,
      );
    }

    const payable = resolution.amount;

    // Atomic debit: the balance check and the deduction are one operation, so
    // two taps (or two devices) can never spend the same rupee twice.
    const debited = await User.findOneAndUpdate(
      { _id: req.user.uid, walletBalance: { $gte: payable } },
      { $inc: { walletBalance: -payable } },
      { new: true, projection: { walletBalance: 1 } }
    );
    if (!debited) {
      return fail(
        res,
        'INSUFFICIENT_WALLET',
        'Wallet balance is not enough. Please add money or pay with UPI / card instead.',
        400
      );
    }

    let payment;
    try {
      payment = await Payment.create({
        userId: req.user.uid,
        type: resolution.paymentType,
        amount: payable,
        method: 'WALLET',
        reference: `WALLET-${Date.now()}`,
        status: 'CONFIRMED',
        metadata: { ...resolution.metadata, paymentDate: new Date() }
      });
    } catch (error) {
      // Nothing was sent anywhere yet - give the money straight back.
      await User.findByIdAndUpdate(req.user.uid, { $inc: { walletBalance: payable } });
      throw error;
    }

    const result = await runServicePayment(payment, { waitMs: 8000 });
    await ensurePaymentInvoice(payment);

    const refreshedUser = await User.findById(req.user.uid).select('walletBalance');

    ok(res, {
      payment,
      walletBalance: refreshedUser?.walletBalance ?? debited.walletBalance,
      clubapi: result,
      service: publicServiceTransaction(result?.transaction) || null
    }, `Wallet ${serviceLabel(resolution.paymentType)} request processed`);
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
          // Razorpay expects a fast webhook response; service work continues
          // in the background and is idempotent with the verify call.
          await completeConfirmedPayment(p, paymentId, { serviceWaitMs: 0 });
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
        const refundId = String(entity.id || '').trim();
        const refundAmountPaise = Number(entity.amount || 0);
        const p = await Payment.findOne({ 'gateway.paymentId': paymentId });
        if (p && refundId && Number.isSafeInteger(refundAmountPaise) && refundAmountPaise > 0) {
          // Claim this Razorpay refund ID once. Razorpay retries webhooks, so
          // without the filter the same partial refund would be counted more
          // than once and could incorrectly mark the whole payment refunded.
          // $inc also keeps two different refund webhooks safe if they arrive
          // concurrently; neither can overwrite the other's amount.
          const claimed = await Payment.findOneAndUpdate(
            {
              _id: p._id,
              'metadata.razorpayRefund.refundIds': { $ne: refundId },
            },
            {
              $set: {
                'metadata.razorpayRefund.lastRefundId': refundId,
                'metadata.razorpayRefund.lastRefundAmountPaise': refundAmountPaise,
                'metadata.razorpayRefund.lastProcessedAt': new Date(),
              },
              $inc: {
                'metadata.razorpayRefund.totalAmountPaise': refundAmountPaise,
              },
              $addToSet: {
                'metadata.razorpayRefund.refundIds': refundId,
              },
            },
            { new: true }
          );

          if (claimed) {
            const totalRefundedPaise = Number(
              claimed.metadata?.razorpayRefund?.totalAmountPaise || 0
            );
            const refundState = razorpayRefundState(claimed.amount, totalRefundedPaise);
            const refundUpdate = {
              'metadata.razorpayRefund.status': refundState.fullyRefunded
                ? 'FULL'
                : 'PARTIAL',
              'metadata.razorpayRefund.totalAmount': totalRefundedPaise / 100,
            };
            if (refundState.fullyRefunded) refundUpdate.status = 'REFUNDED';
            await Payment.updateOne(
              { _id: claimed._id },
              {
                // A partial webhook never writes the payment status. This
                // prevents a slower partial handler from reverting a FULL
                // refund that another concurrent webhook just completed.
                $set: refundUpdate,
              }
            );
          }
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
