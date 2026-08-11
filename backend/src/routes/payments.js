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
import { getRazorpay } from '../services/razorpay.js';
import fraudCheck from '../middlewares/fraudCheck.js';
import { emitToUser } from '../realtime.js';
import { ensurePaymentInvoice } from '../services/paymentInvoiceService.js';
import { notifyUserSmart } from '../services/smartNotifications.js';
import { processPaidRecharge } from '../services/rechargePaymentService.js';

const router = express.Router();

// 1) Create Razorpay Order (loan repayment / bill payment / P2P payment / generic)
router.post('/razorpay/order', requireAuth, fraudCheck, async (req, res, next) => {
  try {
    const { amount, currency = 'INR', loanId = null, billId = null, installmentNo = null, isFullPayment = false, walletTopup = false, recharge = null, notes = {}, payeeUserId = null, payeeVPA = null, payeeName = null, payeeMobile = null, payeeNote = null } =
      await Joi.object({
        amount: Joi.number().min(1).max(100000).required(),
        currency: Joi.string().default('INR'),
        loanId: Joi.string().allow(null, '').default(null),
        billId: Joi.string().allow(null, '').default(null),
        installmentNo: Joi.number().integer().allow(null).default(null),
        isFullPayment: Joi.boolean().default(false),
        walletTopup: Joi.boolean().default(false),
        recharge: Joi.object({
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
        }).allow(null).default(null),
        notes: Joi.object().default({}),
        payeeUserId: Joi.string().allow(null, '').default(null),
        payeeVPA: Joi.string().allow(null, '').default(null),
        payeeName: Joi.string().allow(null, '').default(null),
        payeeMobile: Joi.string().allow(null, '').default(null),
        payeeNote: Joi.string().allow(null, '').default(null)
      }).validateAsync(req.body);

    const rz = getRazorpay();
    const receipt = `KP-${Date.now()}`;
    const order = await rz.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt,
      notes
    });

    const type = recharge ? 'RECHARGE' : (walletTopup ? 'WALLET_TOPUP' : (isFullPayment ? 'FULL_REPAYMENT' : (loanId ? 'REPAYMENT' : (billId ? 'BILL' : (payeeVPA ? 'P2P' : 'OTHER')))));
    const payment = await Payment.create({
      userId: req.user.uid,
      loanId,
      billId,
      installmentNo,
      type,
      amount,
      method: 'RAZORPAY',
      reference: order.id,
      status: 'PENDING',
      gateway: { provider: 'razorpay', orderId: order.id },
      payeeUserId: payeeUserId || undefined,
      payeeDetails: payeeVPA ? { vpa: payeeVPA, name: payeeName, mobile: payeeMobile, note: payeeNote } : undefined,
      metadata: recharge ? {
        notes: notes?.purpose || 'recharge_payment',
        recharge: { ...recharge, amount }
      } : { notes: notes?.purpose || notes?.note || '' }
    });

    ok(res, { order, paymentId: payment._id, key_id: process.env.RAZORPAY_KEY_ID }, 'Order created');
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

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return fail(res, 'BAD_SIGNATURE', 'Signature mismatch', 400);
    }

    const p = await Payment.findOne({ 'gateway.orderId': razorpay_order_id });
    if (!p) return fail(res, 'NOT_FOUND', 'Payment not found', 404);

    const wasConfirmed = p.status === 'CONFIRMED';
    p.status = 'CONFIRMED';
    p.gateway.paymentId = razorpay_payment_id;
    p.gateway.signature = razorpay_signature;
    await p.save();

    if (!wasConfirmed && p.type === 'WALLET_TOPUP') {
      await User.findByIdAndUpdate(p.userId, { $inc: { walletBalance: p.amount } });
    }

    let rechargeResult = null;
    if (!wasConfirmed && p.type === 'RECHARGE') {
      rechargeResult = await processPaidRecharge(p);
    }

    if (p.metadata?.stickerOrderId) {
      await QRStickerOrder.findByIdAndUpdate(p.metadata.stickerOrderId, {
        paymentStatus: 'PAID',
        orderStatus: 'CONFIRMED',
        razorpayPaymentId: razorpay_payment_id
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

    // Link to specific installment or bill
    if (p.loanId) {
      const loan = await Loan.findById(p.loanId);
      if (loan) {
        if (p.type === 'FULL_REPAYMENT') {
          // Mark all unpaid installments as paid
          loan.schedule.forEach(s => {
            if (!s.paid) {
              s.paid = true;
              s.paidAt = new Date();
              s.paymentId = p._id;
            }
          });
          loan.status = 'CLOSED';
          await loan.save();
        } else if (p.installmentNo) {
          // Pay specific installment
          const sched = loan.schedule.find(s => s.installmentNo === p.installmentNo && !s.paid);
          if (sched) {
            sched.paid = true;
            sched.paidAt = new Date();
            sched.paymentId = p._id;
            await loan.save();
          }
        } else {
          // Fallback: pay next unpaid installment
          const sched = loan.schedule.find(s => !s.paid);
          if (sched) {
            sched.paid = true;
            sched.paidAt = new Date();
            sched.paymentId = p._id;
            await loan.save();
          }
        }
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

    if (!wasConfirmed) {
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

    ok(res, { verified: true, paymentId: p._id, recharge: rechargeResult }, 'Payment verified');
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

// 3) Razorpay Webhook (RAW BODY required)
router.post(
  '/razorpay/webhook',
  // IMPORTANT: use raw body for correct signature verification
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      const signature = req.headers['x-razorpay-signature'];
      const rawBody = req.body; // Buffer

      const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      if (expected !== signature) {
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }

      const event = JSON.parse(rawBody.toString('utf8'));

      if (event.event === 'order.paid' || event.event === 'payment.captured') {
        const orderId =
          event.payload?.payment?.entity?.order_id ||
          event.payload?.order?.entity?.id;
        const paymentId = event.payload?.payment?.entity?.id;

        const p = await Payment.findOne({ 'gateway.orderId': orderId });
        if (p) {
          const wasConfirmed = p.status === 'CONFIRMED';
          p.status = 'CONFIRMED';
          p.gateway = { ...(p.gateway || {}), paymentId };
          await p.save();

          if (!wasConfirmed && p.type === 'WALLET_TOPUP') {
            await User.findByIdAndUpdate(p.userId, { $inc: { walletBalance: p.amount } });
          }

          if (!wasConfirmed && p.type === 'RECHARGE') {
            await processPaidRecharge(p);
          }

          if (p.metadata?.stickerOrderId) {
            await QRStickerOrder.findByIdAndUpdate(p.metadata.stickerOrderId, {
              paymentStatus: 'PAID',
              orderStatus: 'CONFIRMED',
              razorpayPaymentId: paymentId
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
              if (p.type === 'FULL_REPAYMENT') {
                // Mark all unpaid installments as paid
                loan.schedule.forEach(s => {
                  if (!s.paid) {
                    s.paid = true;
                    s.paidAt = new Date();
                    s.paymentId = p._id;
                  }
                });
                loan.status = 'CLOSED';
                await loan.save();
              } else if (p.installmentNo) {
                // Pay specific installment
                const sched = loan.schedule.find(s => s.installmentNo === p.installmentNo && !s.paid);
                if (sched) {
                  sched.paid = true;
                  sched.paidAt = new Date();
                  sched.paymentId = p._id;
                  await loan.save();
                }
              } else {
                // Fallback: pay next unpaid installment
                const sched = loan.schedule.find(s => !s.paid);
                if (sched) {
                  sched.paid = true;
                  sched.paidAt = new Date();
                  sched.paymentId = p._id;
                  await loan.save();
                }
              }
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
        }
      }

      return res.json({ success: true });
    } catch (e) {
      console.error('Webhook error', e);
      return res.status(500).json({ success: false, message: 'Webhook error' });
    }
  }
);

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
