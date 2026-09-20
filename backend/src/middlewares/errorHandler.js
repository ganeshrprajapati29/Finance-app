/**
 * Central error handling.
 *
 * Guarantees, in order of importance:
 *  1. Every failure leaves the process as JSON in the standard envelope
 *     ({ success, message, data, code }) - never HTML, never a dangling
 *     request.
 *  2. Nothing from the environment (secrets, connection strings, tokens,
 *     absolute paths) reaches the client.
 *  3. Joi validation problems come back as a readable 400 naming the field
 *     that is wrong, not a raw schema dump.
 */

import crypto from 'crypto';

import { describeRazorpayError, isRazorpaySdkError } from '../services/razorpay.js';

export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    data: null,
    code: 'NOT_FOUND',
  });
}

/**
 * Env values long enough to be meaningful secrets. Any of these appearing in
 * an outbound message is redacted, which covers the case where a driver or
 * SDK embeds a connection string or key in its error text.
 */
function secretValues() {
  const keys = Object.keys(process.env).filter((key) =>
    /SECRET|PASSWORD|PASS|TOKEN|KEY|URI|DSN|CREDENTIAL|PRIVATE/i.test(key)
  );
  return keys
    .map((key) => process.env[key])
    .filter((value) => typeof value === 'string' && value.length >= 8);
}

function redact(message) {
  if (!message) return message;
  let out = String(message);
  for (const secret of secretValues()) {
    if (out.includes(secret)) out = out.split(secret).join('[redacted]');
  }
  // Strip anything that still looks like credentials in a URL.
  out = out.replace(/(\w+:\/\/)[^@\s/]+:[^@\s/]+@/g, '$1[redacted]@');
  // Strip absolute filesystem paths that leak deployment layout.
  out = out.replace(/(?:[A-Za-z]:)?[\\/](?:[\w.-]+[\\/]){2,}[\w.-]+/g, '[path]');
  return out;
}

function isJoiError(err) {
  return Boolean(err?.isJoi) || err?.name === 'ValidationError';
}

/**
 * Turns a Joi error into one readable sentence.
 * `"personal.mobile" is required` -> `Mobile is required.`
 */
function joiMessage(err) {
  const details = Array.isArray(err?.details) ? err.details : [];
  if (!details.length) {
    return 'Some details are missing or incorrect. Please check and try again.';
  }

  const messages = details.slice(0, 3).map((detail) => {
    const path = Array.isArray(detail.path) ? detail.path : [];
    const field = path.length ? path[path.length - 1] : '';
    const label = String(field)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[._-]+/g, ' ')
      .trim();

    const text = String(detail.message || '')
      // Joi quotes the full path; swap it for the friendly label.
      .replace(/"[^"]+"/, label ? label.charAt(0).toUpperCase() + label.slice(1) : 'This field')
      .trim();

    return text.endsWith('.') ? text : `${text}.`;
  });

  return messages.join(' ');
}

/** Mongoose duplicate-key errors name the field that collided. */
function duplicateMessage(err) {
  const field = Object.keys(err?.keyPattern || err?.keyValue || {})[0];
  const label = field
    ? field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
    : 'detail';
  return `This ${label} is already linked to another account.`;
}

/** Safe, generic text for anything we do not want to describe precisely. */
function friendlyMessage(err) {
  if (err?.code === 11000) return duplicateMessage(err);
  if (err?.name === 'CastError') return 'Invalid request. Please try again.';
  if (err?.name === 'TokenExpiredError') {
    return 'Your session has expired. Please sign in again.';
  }
  if (err?.name === 'JsonWebTokenError') {
    return 'Your session is not valid. Please sign in again.';
  }
  if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') {
    return 'That file is too large. Please upload a smaller file.';
  }
  if (
    err?.code === 'ECONNABORTED' ||
    err?.code === 'ETIMEDOUT' ||
    /timeout/i.test(err?.message || '')
  ) {
    return 'The service is responding slowly. Please try again in a moment.';
  }
  if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND') {
    return 'The service is unavailable right now. Please try again in a moment.';
  }
  return 'Something went wrong. Please try again.';
}

function resolveStatus(err) {
  // Razorpay's SDK rejects with { statusCode: 401, error: {...} } when it
  // refuses our credentials. That 401 belongs to the gateway, not the
  // customer's session - passing it through made the app refresh its login
  // and then show a blank "Something went wrong".
  if (isRazorpaySdkError(err)) return 502;
  if (isJoiError(err)) return 400;
  if (err?.code === 11000) return 409;
  if (err?.name === 'CastError') return 400;
  if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
    return 401;
  }
  if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') {
    return 413;
  }
  const status = Number(err?.status || err?.statusCode);
  if (Number.isInteger(status) && status >= 400 && status <= 599) return status;
  return 500;
}

/**
 * True for errors raised by a driver/SDK/library rather than by our own route
 * code. Their `.message` is written for developers ("E11000 duplicate key..."),
 * so it is replaced with friendly text even at 4xx.
 */
function isSystemError(err) {
  return (
    err?.code === 11000 ||
    err?.name === 'CastError' ||
    err?.name === 'TokenExpiredError' ||
    err?.name === 'JsonWebTokenError' ||
    err?.type === 'entity.too.large' ||
    err?.code === 'LIMIT_FILE_SIZE' ||
    ['ECONNABORTED', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'].includes(err?.code)
  );
}

/**
 * Node/libuv errno codes (ECONNRESET, ENOTFOUND, EPIPE...). These describe our
 * infrastructure, not the caller's request, so they are never returned as API
 * codes. Our own codes either contain an underscore or do not follow this
 * shape, so the pattern does not catch them.
 */
const NODE_ERRNO = /^E[A-Z]+$/;

function resolveCode(err, status) {
  if (isRazorpaySdkError(err)) return 'PAYMENT_GATEWAY_ERROR';
  if (isJoiError(err)) return 'VALIDATION_ERROR';
  if (err?.code === 11000) return 'DUPLICATE_ENTRY';

  // Only our own string codes are surfaced; numeric and errno codes are
  // internal detail and collapse into a generic bucket.
  if (
    typeof err?.code === 'string' &&
    /^[A-Z][A-Z0-9_]*$/.test(err.code) &&
    !NODE_ERRNO.test(err.code)
  ) {
    return err.code;
  }

  return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
}

export function errorHandler(err, req, res, next) {
  const status = resolveStatus(err);
  const code = resolveCode(err, status);

  // Full detail server-side only. 5xx errors get a short reference that is
  // printed in the log and returned to the client, so a customer's screenshot
  // leads straight to the matching log line.
  const ref = status >= 500 ? `E${crypto.randomBytes(3).toString('hex').toUpperCase()}` : null;
  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}] ref=${ref}`, err);
  } else {
    console.warn(`[${req.method} ${req.originalUrl}] ${code}: ${err?.message}`);
  }

  // Headers already flushed (e.g. a stream failed mid-response) - hand back to
  // Express so the socket is torn down rather than writing a second body.
  if (res.headersSent) return next(err);

  let message;
  if (isRazorpaySdkError(err)) {
    const info = describeRazorpayError(err);
    message = info.authFailed
      ? 'Payment could not be started (gateway authentication failed). Please try again later.'
      : `Payment could not be started (${redact(info.description) || 'gateway error'}). Please try again later.`;
  } else if (isJoiError(err)) {
    message = joiMessage(err);
  } else if (isSystemError(err)) {
    // Library-authored text - swap for something a user can act on.
    message = friendlyMessage(err);
  } else if (err?.expose === true && err?.message) {
    // Errors we raise on purpose and mark safe to show (e.g. "payments are
    // temporarily unavailable", payment gateway rejections), including 5xx.
    message = redact(err.message);
  } else if (status < 500 && err?.message) {
    // 4xx errors are raised deliberately by our own routes, so their message
    // is meant for the user - still redacted in case a downstream SDK message
    // was rethrown with a 4xx status.
    message = redact(err.message);
  } else {
    // 5xx: never echo the original text; it can carry driver internals.
    message = friendlyMessage(err);
  }

  const body = { success: false, message, data: null, code };
  if (ref) {
    body.message = `${message} (Ref: ${ref})`;
    body.data = { ref };
  }

  // Routes can attach safe context (e.g. the blocking loan on an eligibility
  // conflict) via err.data.
  if (err?.data && typeof err.data === 'object') body.data = err.data;

  res.status(status).json(body);
}
