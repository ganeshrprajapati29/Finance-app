import Razorpay from 'razorpay';

let razorpayInstance = null;

/**
 * Thrown when Razorpay credentials are missing. Carries `status`/`code` so the
 * central error handler turns it into a clean 503 instead of a 500 with a
 * stack trace, and never echoes which variable is missing to the client.
 */
class RazorpayConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RazorpayConfigError';
    this.status = 503;
    this.code = 'PAYMENT_GATEWAY_UNCONFIGURED';
    this.expose = true;
  }
}

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Reports which Razorpay variables are absent. Used at boot for a loud log
 * line and by the guards below.
 * @returns {string[]} names of missing variables
 */
export function missingRazorpayEnv({ requireWebhook = false } = {}) {
  const required = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
  if (requireWebhook) required.push('RAZORPAY_WEBHOOK_SECRET');
  return required.filter((name) => !trimmed(process.env[name]));
}

/**
 * Throws a clean 503 when order/verification credentials are not configured,
 * rather than letting the Razorpay SDK fail deep inside a request with an
 * opaque error.
 */
export function assertRazorpayConfigured() {
  const missing = missingRazorpayEnv();
  if (missing.length) {
    // Names are logged server-side only; the client sees the generic message.
    console.error(`[razorpay] missing env: ${missing.join(', ')}`);
    throw new RazorpayConfigError(
      'Payments are temporarily unavailable. Please try again later.'
    );
  }
}

/**
 * The webhook secret is only needed by the webhook handler, so it is checked
 * separately - a deployment without webhooks can still take payments.
 * @returns {string} the configured webhook secret
 */
export function requireWebhookSecret() {
  const secret = trimmed(process.env.RAZORPAY_WEBHOOK_SECRET);
  if (!secret) {
    console.error('[razorpay] missing env: RAZORPAY_WEBHOOK_SECRET');
    throw new RazorpayConfigError('Webhook is not configured.');
  }
  return secret;
}

/** @returns {string} the public key id, safe to hand to the client. */
export function razorpayKeyId() {
  assertRazorpayConfigured();
  return trimmed(process.env.RAZORPAY_KEY_ID);
}

/** @returns {string} the secret, for server-side HMAC only. Never returned to a client. */
export function razorpayKeySecret() {
  assertRazorpayConfigured();
  return trimmed(process.env.RAZORPAY_KEY_SECRET);
}

/**
 * Lazily builds the SDK client. Credentials are validated first so a
 * misconfigured deployment fails with a clear 503 at the call site.
 */
export function getRazorpay() {
  assertRazorpayConfigured();
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: trimmed(process.env.RAZORPAY_KEY_ID),
      key_secret: trimmed(process.env.RAZORPAY_KEY_SECRET),
    });
  }
  return razorpayInstance;
}

/**
 * Converts a rupee amount to the integer paise Razorpay expects.
 * `Math.round` avoids the floating-point drift that would otherwise turn
 * 1234.56 into 123455 paise.
 * @param {number|string} amount rupees
 * @returns {number} paise
 */
export function toPaise(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    const error = new Error('Invalid payment amount.');
    error.status = 400;
    error.code = 'INVALID_AMOUNT';
    error.expose = true;
    throw error;
  }
  return Math.round(value * 100);
}

export { RazorpayConfigError };
