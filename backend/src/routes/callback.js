import { Router } from 'express';
import ClubAPITransaction from './clubapi/models/transaction.js';
import Transaction from '../models/Transaction.js';
import { emitToUser } from '../realtime.js';

const router = Router();

function localStatus(payload = {}) {
  const raw = String(payload.status || payload.txnStatus || payload.transactionStatus || '').toUpperCase();
  const text = String(payload.resText || payload.message || '').toLowerCase();
  if (raw === 'SUCCESS' || raw === 'COMPLETED' || /success|completed/.test(text)) return 'completed';
  if (['FAILED', 'FAILURE', 'ERROR', 'CANCELLED', 'CANCELED'].includes(raw) || /fail|error|cancel|reject/.test(text)) return 'failed';
  return 'processing';
}

router.get('/clubapi', (req, res) => {
  res.json({ success: true, message: 'ClubAPI callback endpoint is active' });
});

router.post(['/clubapi', '/recharge'], async (req, res) => {
  try {
    const payload = { ...req.query, ...req.body };
    const urid = payload.urid || payload.URID;
    const status = localStatus(payload);

    if (urid) {
      const clubTransaction = await ClubAPITransaction.findOneAndUpdate(
        { urid },
        { status, response: payload },
        { new: true }
      );

      if (clubTransaction?.userId) {
        emitToUser(clubTransaction.userId, 'clubapi:transaction_updated', {
          urid,
          status: clubTransaction.status,
          type: clubTransaction.type,
          amount: clubTransaction.amount,
          transaction: clubTransaction
        });
      }

      await Transaction.findOneAndUpdate(
        { urid },
        {
          status: status === 'completed' ? 'success' : status === 'failed' ? 'failed' : 'processing',
          clubapiResponse: payload,
          updatedAt: new Date()
        }
      );
    }

    res.json({ success: true, message: 'Callback received' });
  } catch (error) {
    console.error('ClubAPI callback processing error:', error);
    res.json({ success: false, message: 'Callback processing failed' });
  }
});

export default router;
