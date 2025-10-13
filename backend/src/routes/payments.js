// src/routes/payments.js
import express from 'express';
import crypto from 'crypto';
import Joi from 'joi';
import Payment from '../models/Payment.js';
import Loan from '../models/Loan.js';
import Bill from '../models/Bill.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { ok, fail } from '../utils/response.js';
import { getRazorpay } from '../services/razorpay.js';

const router = express.Router();



// 1) Create Razorpay Order (loan repayment / bill payment / generic)
router.post('/razorpay/order', requireAuth, async (req, res, next) => {
  try {
    const { amount, currency = 'INR', loanId = null, billId = null, notes = {} } =
      await Joi.object({
        amount: Joi.number().min(1).required(),
        currency: Joi.string().default('INR'),
        loanId: Joi.string().allow(null, '').default(null),
        billId: Joi.string().allow(null, '').default(null),
        notes: Joi.object().default({})
      }).validateAsync(req.body);

    const rz = getRazorpay();
    const receipt = `KP-${Date.now()}`;
    const order = await rz.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt,
      notes
    });

    const type = loanId ? 'REPAYMENT' : (billId ? 'BILL' : 'OTHER');
    const payment = await Payment.create({
      userId: req.user.uid,
      loanId,
      billId,
      type,
      amount,
      method: 'RAZORPAY',
      reference: order.id,
      status: 'PENDING',
      gateway: { provider: 'razorpay', orderId: order.id }
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

    p.status = 'CONFIRMED';
    p.gateway.paymentId = razorpay_payment_id;
    p.gateway.signature = razorpay_signature;
    await p.save();

    // Link to next unpaid installment or bill
    if (p.loanId) {
      const loan = await Loan.findById(p.loanId);
      if (loan) {
        const sched = loan.schedule.find(s => !s.paid);
        if (sched) {
          sched.paid = true;
          sched.paidAt = new Date();
          sched.paymentId = p._id;
          await loan.save();
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

    ok(res, { verified: true, paymentId: p._id }, 'Payment verified');
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
          p.status = 'CONFIRMED';
          p.gateway = { ...(p.gateway || {}), paymentId };
          await p.save();

          if (p.loanId) {
            const loan = await Loan.findById(p.loanId);
            if (loan) {
              const sched = loan.schedule.find(s => !s.paid);
              if (sched) {
                sched.paid = true;
                sched.paidAt = new Date();
                sched.paymentId = p._id;
                await loan.save();
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
    ok(res, p, 'Payment confirmed');
  } catch (e) { next(e); }
});

export default router;
