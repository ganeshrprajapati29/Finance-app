import 'dotenv/config';
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

/**
 * Razorpay reports refund amounts in paise. Keep the comparison in integer
 * paise so partial refunds and decimal rupee amounts cannot be misclassified
 * because of floating-point rounding.
 */
export function razorpayRefundState(paymentAmount, refundedPaise) {
  const paymentPaise = toPaise(paymentAmount);
  const totalRefundedPaise = Number(refundedPaise);
  if (!Number.isSafeInteger(totalRefundedPaise) || totalRefundedPaise < 0) {
    const error = new Error('Invalid refund amount.');
    error.status = 400;
    error.code = 'INVALID_REFUND_AMOUNT';
    throw error;
  }
  return {
    paymentPaise,
    totalRefundedPaise,
    fullyRefunded: totalRefundedPaise >= paymentPaise,
  };
}

/**
 * Razorpay rejected a request (bad credentials, account not activated, invalid
 * parameters...). Always a 502 to the client: a gateway problem is not the
 * customer's session expiring, and passing Razorpay's own 401 through made the
 * app think its login had expired.
 */
class PaymentGatewayError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PaymentGatewayError';
    this.status = 502;
    this.code = 'PAYMENT_GATEWAY_ERROR';
    this.expose = true;
    this.gateway = details;
  }
}

/**
 * True for errors thrown by the Razorpay Node SDK, which rejects with a plain
 * object (not an Error): { statusCode, error: { code, description, ... } }.
 */
export function isRazorpaySdkError(err) {
  return Boolean(
    err &&
      !(err instanceof Error) &&
      typeof err === 'object' &&
      Number.isInteger(Number(err.statusCode)) &&
      err.error &&
      typeof err.error === 'object'
  );
}

/** Extracts the useful, non-secret parts of a Razorpay SDK error. */
export function describeRazorpayError(err) {
  const body = err?.error && typeof err.error === 'object' ? err.error : {};
  const httpStatus = Number(err?.statusCode) || 0;
  const description = String(body.description || err?.message || '').trim();
  return {
    httpStatus,
    code: String(body.code || '').trim(),
    description,
    field: String(body.field || '').trim(),
    reason: String(body.reason || '').trim(),
    authFailed: httpStatus === 401 || /authentication/i.test(description),
  };
}

/** Converts any Razorpay SDK failure into a PaymentGatewayError. */
export function toPaymentGatewayError(err, action = 'create the payment') {
  if (err instanceof RazorpayConfigError || err instanceof PaymentGatewayError) return err;
  const info = describeRazorpayError(err);
  console.error(
    `[razorpay] could not ${action}: HTTP ${info.httpStatus || '-'} ${info.code || ''} ${info.description || ''}`.trim()
  );
  const reason = info.authFailed
    ? 'gateway authentication failed'
    : info.description || 'the payment gateway did not respond';
  return new PaymentGatewayError(
    `Payment could not be started (${reason}). Please try again later.`,
    info
  );
}

/**
 * Creates a Razorpay order. On failure throws a PaymentGatewayError carrying
 * Razorpay's reason instead of the SDK's opaque object.
 */
export async function createRazorpayOrder(params) {
  const rz = getRazorpay();
  try {
    return await rz.orders.create(params);
  } catch (err) {
    throw toPaymentGatewayError(err, 'create the order');
  }
}

/**
 * Admin health check: are the configured keys accepted by Razorpay? Uses a
 * read-only call and never returns the secret.
 */
export async function checkRazorpayConnection() {
  const keyId = trimmed(process.env.RAZORPAY_KEY_ID);
  const result = {
    configured: missingRazorpayEnv().length === 0,
    keyMode: keyId.startsWith('rzp_live_') ? 'LIVE' : keyId.startsWith('rzp_test_') ? 'TEST' : keyId ? 'UNKNOWN' : 'MISSING',
    keyId: keyId ? `${keyId.slice(0, 9)}...${keyId.slice(-4)}` : '',
    webhookSecretConfigured: Boolean(trimmed(process.env.RAZORPAY_WEBHOOK_SECRET)),
    ok: false,
    message: '',
  };

  if (!result.configured) {
    result.message = `Missing: ${missingRazorpayEnv().join(', ')}`;
    return result;
  }

  try {
    await getRazorpay().orders.all({ count: 1 });
    result.ok = true;
    result.message = 'Razorpay accepted the key id and secret.';
  } catch (err) {
    const info = describeRazorpayError(err);
    result.message = info.authFailed
      ? 'Razorpay rejected the key id / secret (authentication failed). Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server.'
      : `Razorpay error: ${info.description || err?.message || 'no response'}`;
  }
  return result;
}

export { RazorpayConfigError, PaymentGatewayError };
