import express from 'express';
import ClubAPITransaction from './clubapi/models/transaction.js';
import { clubStatusToLocal, handleRechargeCallbackRefund } from '../services/rechargePaymentService.js';
import { emitToUser } from '../realtime.js';

const router = express.Router();

function callbackOrderId(payload = {}) {
  return payload.orderId || payload.order_id || payload.ourSystemId || payload.ourSystemOrderId || '';
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

router.get('/clubapi', (req, res) => {
  res.json({ success: true, message: 'ClubAPI callback endpoint is active' });
});

router.post('/clubapi', async (req, res, next) => {
  try {
    const payload = req.body || {};
    const urid = payload.urid || payload.ourSystemId || payload.ourSystemOrderId || '';
    const orderId = callbackOrderId(payload);

    const query = [];
    if (urid) query.push({ urid });
    if (orderId) {
      query.push({ 'response.orderId': orderId });
      query.push({ 'response.data.orderId': orderId });
    }

    const transaction = query.length ? await ClubAPITransaction.findOne({ $or: query }) : null;
    if (transaction) {
      transaction.status = clubStatusToLocal(payload);
      transaction.response = {
        ...(transaction.response?.toObject?.() || transaction.response || {}),
        callback: payload,
        callbackReceivedAt: new Date()
      };
      await transaction.save();

      if (transaction.status === 'failed') {
        await handleRechargeCallbackRefund(transaction);
      }

      emitClubTransaction(transaction.userId, transaction);
    }

    res.json({ success: true, message: 'Callback received' });
  } catch (error) {
    next(error);
  }
});

export default router;
