import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { fail } from '../utils/response.js';

const router = express.Router();

// Disabled: this DTH recharge endpoint had no authentication and tried to call
// ClubAPI directly without any customer payment. Recharges now go through
// /api/payments (Razorpay or wallet) with a `service` payload.
router.post('/dth/recharge', requireAuth, (req, res) =>
  fail(res, 'PAYMENT_REQUIRED', 'Please recharge from the Recharge & Bills section of the app.', 403)
);

export default router;
