import crypto from 'crypto';
import express from 'express';

import { applyClubapiCallback } from '../services/rechargePaymentService.js';

const router = express.Router();

/**
 * Optional shared secret for the ClubAPI callback URL. When
 * CLUBAPI_CALLBACK_SECRET is set, register the callback in the ClubAPI panel
 * as  https://<host>/api/callback/clubapi?key=<secret>  and every other caller
 * is rejected. Either way a callback can never refund anyone by itself - its
 * status is verified with ClubAPI's status API first.
 */
function callbackAuthorized(req) {
  const secret = String(process.env.CLUBAPI_CALLBACK_SECRET || '').trim();
  if (!secret) return true;
  const supplied = String(req.query.key || req.get('x-callback-key') || '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handleClubAPICallback(req, res) {
  if (!callbackAuthorized(req)) {
    return res.status(401).json({ success: false, message: 'Unauthorized', data: null });
  }

  // ClubAPI may call back with query parameters (GET) or a JSON / form body.
  const payload = { ...(req.query || {}), ...(req.body && typeof req.body === 'object' ? req.body : {}) };
  delete payload.key;

  const hasReference = payload.urid || payload.orderId || payload.order_id || payload.ourSystemId;
  if (!hasReference) {
    return res.json({ success: true, message: 'ClubAPI callback endpoint is active', data: null });
  }

  try {
    const result = await applyClubapiCallback(payload);
    // Always 200 so ClubAPI does not keep retrying a callback we recorded.
    return res.json({ success: true, message: 'Callback received', data: { matched: result.matched } });
  } catch (error) {
    console.error('ClubAPI callback error:', error.message);
    return res.json({ success: true, message: 'Callback received', data: { matched: false } });
  }
}

router.get('/clubapi', handleClubAPICallback);
router.post('/', handleClubAPICallback);
router.post('/clubapi', handleClubAPICallback);

router.get('/juspay-consumer', (req, res) => {
  res.json({ success: true, message: 'Juspay Consumer callback endpoint is active', data: null });
});

router.post('/juspay-consumer', (req, res) => {
  res.json({ success: true, message: 'Juspay Consumer callback received', data: null });
});

export default router;
