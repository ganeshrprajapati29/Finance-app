import crypto from 'crypto';
import { velxapayConfig } from '../../config/velxapay.js';

export function verifyVelxapayWebhook(rawBody, signature) {
  const secret = velxapayConfig.webhookSecret || velxapayConfig.signingKey;
  if (!secret || !signature || !rawBody) return false;
  const expected = crypto.createHmac('md5', secret).update(rawBody).digest('hex');
  const supplied = String(signature).trim().toLowerCase();
  if (expected.length !== supplied.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}
