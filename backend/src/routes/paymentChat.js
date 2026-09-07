import { Router } from 'express';
import Joi from 'joi';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import PaymentChatThread from '../models/PaymentChatThread.js';
import PaymentChatMessage from '../models/PaymentChatMessage.js';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import { emitToUser } from '../realtime.js';
import { getRazorpay } from '../services/razorpay.js';

const router = Router();

function normalizeMobile(value = '') {
  const digits = String(value).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function bankFromUpi(upiId = '') {
  const handle = String(upiId).split('@')[1]?.toLowerCase() || '';
  const map = {
    ybl: 'Yes Bank',
    axl: 'Axis Bank',
    okaxis: 'Axis Bank',
    okhdfcbank: 'HDFC Bank',
    okicici: 'ICICI Bank',
    oksbi: 'State Bank of India',
    paytm: 'Paytm Payments Bank',
    airtel: 'Airtel Payments Bank',
   ibl: 'ICICI Bank',
    sbi: 'State Bank of India',
    hdfcbank: 'HDFC Bank',
    icici: 'ICICI Bank',
    upi: 'UPI Linked Bank'
  };
  return map[handle] || (handle ? `${handle.toUpperCase()} UPI Bank` : 'UPI Linked Bank');
}

function userBankName(user) {
  return user?.bankName || bankFromUpi(user?.upiId);
}

function participantKey(a, b) {
  return [String(a), String(b)].sort().join(':');
}

async function getOrCreateThread(userId, peer) {
  const key = participantKey(userId, peer._id);
  let thread = await PaymentChatThread.findOne({ participantKey: key });
  if (!thread) {
    thread = await PaymentChatThread.create({
      participants: [userId, peer._id],
      participantKey: key,
      peerSnapshot: {
        name: peer.name,
        mobile: peer.mobile,
        upiId: peer.upiId,
        bankName: userBankName(peer)
      },
      lastMessageAt: new Date()
    });
  }
  return thread;
}

async function serializeThread(thread, currentUserId) {
  await thread.populate('participants', 'name mobile upiId bankName accountName');
  const peer = thread.participants.find((user) => String(user._id) !== String(currentUserId)) || thread.participants[0];
  return {
    _id: thread._id,
    lastMessage: thread.lastMessage,
    lastMessageAt: thread.lastMessageAt,
    peer: peer ? {
      id: peer._id,
      name: peer.name,
      mobile: peer.mobile,
      upiId: peer.upiId,
      bankName: userBankName(peer),
      accountName: peer.accountName || peer.name
    } : thread.peerSnapshot
  };
}

router.get('/resolve', requireAuth, async (req, res, next) => {
  try {
    const { q = '' } = req.query;
    const mobile = normalizeMobile(q);
    const query = mobile.length >= 10
      ? { mobile }
      : { upiId: String(q).trim().toLowerCase() };
    const user = await User.findOne({ ...query, _id: { $ne: req.user.uid } }).select('name mobile upiId bankName accountName');
    if (!user) return fail(res, 'NOT_FOUND', 'Receiver not found', 404);
    ok(res, {
      id: user._id,
      name: user.name || 'KhatuPay User',
      mobile: user.mobile,
      upiId: user.upiId,
      bankName: userBankName(user),
      accountName: user.accountName || user.name
    });
  } catch (e) { next(e); }
});

router.get('/threads', requireAuth, async (req, res, next) => {
  try {
    const threads = await PaymentChatThread.find({ participants: req.user.uid }).sort({ lastMessageAt: -1, updatedAt: -1 });
    ok(res, await Promise.all(threads.map((thread) => serializeThread(thread, req.user.uid))));
  } catch (e) { next(e); }
});

router.post('/threads', requireAuth, async (req, res, next) => {
  try {
    const { mobile, upiId } = await Joi.object({
      mobile: Joi.string().allow('', null),
      upiId: Joi.string().allow('', null)
    }).validateAsync(req.body);
    const query = mobile ? { mobile: normalizeMobile(mobile) } : { upiId: String(upiId || '').trim().toLowerCase() };
    const peer = await User.findOne({ ...query, _id: { $ne: req.user.uid } }).select('name mobile upiId bankName accountName');
    if (!peer) return fail(res, 'NOT_FOUND', 'Receiver not found', 404);
    const thread = await getOrCreateThread(req.user.uid, peer);
    ok(res, await serializeThread(thread, req.user.uid));
  } catch (e) { next(e); }
});

router.get('/threads/:id', requireAuth, async (req, res, next) => {
  try {
    const thread = await PaymentChatThread.findOne({ _id: req.params.id, participants: req.user.uid });
    if (!thread) return fail(res, 'NOT_FOUND', 'Chat not found', 404);
    ok(res, await serializeThread(thread, req.user.uid));
  } catch (e) { next(e); }
});

router.get('/threads/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const thread = await PaymentChatThread.findOne({ _id: req.params.id, participants: req.user.uid });
    if (!thread) return fail(res, 'NOT_FOUND', 'Chat not found', 404);
    const messages = await PaymentChatMessage.find({ threadId: thread._id })
      .populate('paymentId')
      .sort({ createdAt: 1 })
      .limit(200);
    ok(res, messages);
  } catch (e) { next(e); }
});

router.post('/threads/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const { text } = await Joi.object({ text: Joi.string().trim().min(1).max(1000).required() }).validateAsync(req.body);
    const thread = await PaymentChatThread.findOne({ _id: req.params.id, participants: req.user.uid });
    if (!thread) return fail(res, 'NOT_FOUND', 'Chat not found', 404);
    const receiverId = thread.participants.find((id) => String(id) !== String(req.user.uid));
    const message = await PaymentChatMessage.create({
      threadId: thread._id,
      senderId: req.user.uid,
      receiverId,
      kind: 'TEXT',
      text
    });
    thread.lastMessage = text;
    thread.lastMessageAt = new Date();
    await thread.save();
    emitToUser(receiverId, 'payment_chat:new_message', message);
    ok(res.status(201), message, 'Message sent');
  } catch (e) { next(e); }
});

router.post('/threads/:id/payments/order', requireAuth, async (req, res, next) => {
  try {
    const { amount, note = '' } = await Joi.object({
      amount: Joi.number().min(1).max(100000).required(),
      note: Joi.string().allow('', null).default('')
    }).validateAsync(req.body);

    const thread = await PaymentChatThread.findOne({ _id: req.params.id, participants: req.user.uid });
    if (!thread) return fail(res, 'NOT_FOUND', 'Chat not found', 404);
    const receiverId = thread.participants.find((id) => String(id) !== String(req.user.uid));
    const peer = await User.findById(receiverId).select('name mobile upiId bankName accountName');
    if (!peer) return fail(res, 'NOT_FOUND', 'Receiver not found', 404);

    const payer = await User.findById(req.user.uid).select('name email mobile phone');

    const payment = new Payment({
      userId: req.user.uid,
      payeeUserId: peer._id,
      type: 'P2P',
      amount,
      method: 'RAZORPAY',
      reference: `KP-CHAT-${Date.now()}`,
      status: 'PENDING',
      gateway: { provider: 'razorpay' },
      payeeDetails: {
        vpa: peer.upiId,
        name: peer.name,
        mobile: peer.mobile,
        note,
        bankName: userBankName(peer),
        accountName: peer.accountName || peer.name
      },
      metadata: { notes: note || 'KhatuPay chat payment', paymentDate: new Date() }
    });
    await payment.validate();

    let order;
    try {
      const rz = getRazorpay();
      order = await rz.orders.create({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: `KP-CHAT-${Date.now()}`,
        notes: {
          purpose: 'payment_chat',
          paymentId: String(payment._id),
          threadId: String(thread._id),
          payeeUserId: String(peer._id)
        },
      });
    } catch (gatewayError) {
      const gatewayMessage =
        gatewayError.response?.data?.message ||
        gatewayError.response?.data?.error ||
        gatewayError.message ||
        'Payment gateway could not start the payment.';
      return fail(res, 'PAYMENT_GATEWAY_ERROR', gatewayMessage, 400);
    }

    payment.reference = order.id;
    payment.gateway = {
      provider: 'razorpay',
      orderId: order.id
    };
    payment.metadata = {
      ...(payment.metadata?.toObject?.() || payment.metadata || {}),
      razorpay: { orderId: order.id, customerMobile: payer?.mobile || payer?.phone || '' }
    };
    await payment.save();

    const message = await PaymentChatMessage.create({
      threadId: thread._id,
      senderId: req.user.uid,
      receiverId: peer._id,
      kind: 'PAYMENT',
      text: note,
      paymentId: payment._id,
      paymentStatus: 'PENDING',
      amount,
      khatuPaymentId: payment.khatuPaymentId,
      meta: {
        payeeName: peer.name,
        payeeMobile: peer.mobile,
        payeeVpa: peer.upiId,
        bankName: userBankName(peer)
      }
    });

    thread.lastMessage = `Payment of Rs. ${amount}`;
    thread.lastPaymentId = payment._id;
    thread.lastMessageAt = new Date();
    await thread.save();

    emitToUser(peer._id, 'payment_chat:new_message', message);
    ok(res, {
      order,
      paymentId: payment._id,
      khatuPaymentId: payment.khatuPaymentId,
      message,
      key_id: process.env.RAZORPAY_KEY_ID,
      gateway: 'razorpay'
    }, 'Payment order created');
  } catch (e) { next(e); }
});

router.get('/payments', requireAuth, async (req, res, next) => {
  try {
    const payments = await Payment.find({
      type: 'P2P',
      $or: [{ userId: req.user.uid }, { payeeUserId: req.user.uid }]
    }).populate('userId', 'name mobile upiId').populate('payeeUserId', 'name mobile upiId').sort({ createdAt: -1 });
    ok(res, payments);
  } catch (e) { next(e); }
});

export default router;
