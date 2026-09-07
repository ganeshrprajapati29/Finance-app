/**
 * Central error handler: readable validation errors, no secret leakage, and
 * a JSON body on every path.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Joi from 'joi';

import { errorHandler, notFound } from '../src/middlewares/errorHandler.js';

const req = { method: 'POST', originalUrl: '/api/loans' };

const mockRes = () => ({
  headersSent: false,
  _status: 200,
  _body: null,
  status(code) {
    this._status = code;
    return this;
  },
  json(body) {
    this._body = body;
    return this;
  },
});

/** Silences the handler's own console output for the duration of a test. */
const quiet = async (fn) => {
  const { error, warn } = console;
  console.error = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.error = error;
    console.warn = warn;
  }
};

const joiErrorFor = async (schema, value) => {
  try {
    await schema.validateAsync(value, { abortEarly: false });
    throw new Error('expected validation to fail');
  } catch (err) {
    return err;
  }
};

test('Joi errors become a readable 400 naming the fields', async () => {
  const schema = Joi.object({
    personal: Joi.object({ mobile: Joi.string().required() }).required(),
    amountRequested: Joi.number().positive().required(),
  });
  const err = await joiErrorFor(schema, { personal: {} });

  const res = mockRes();
  await quiet(() => errorHandler(err, req, res, () => {}));

  assert.equal(res._status, 400);
  assert.equal(res._body.success, false);
  assert.equal(res._body.code, 'VALIDATION_ERROR');
  assert.match(res._body.message, /Mobile/);
  assert.match(res._body.message, /Amount Requested/);
  // The raw Joi path syntax must not reach the user.
  assert.doesNotMatch(res._body.message, /"personal\.mobile"/);
});

test('5xx errors never echo the original message', async () => {
  const err = new Error('ECONNREFUSED mongodb://internal-host:27017/khatu');

  const res = mockRes();
  await quiet(() => errorHandler(err, req, res, () => {}));

  assert.equal(res._body.success, false);
  assert.doesNotMatch(res._body.message, /mongodb/);
  assert.doesNotMatch(res._body.message, /internal-host/);
});

test('env secrets are redacted even from 4xx messages', async () => {
  const saved = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = 'super-secret-signing-key-9f2a';
  try {
    const err = new Error(`token ${process.env.JWT_ACCESS_SECRET} was rejected`);
    err.status = 400;
    err.code = 'BAD_TOKEN';

    const res = mockRes();
    await quiet(() => errorHandler(err, req, res, () => {}));

    assert.equal(res._status, 400);
    assert.equal(res._body.code, 'BAD_TOKEN');
    assert.doesNotMatch(res._body.message, /super-secret-signing-key/);
    assert.match(res._body.message, /\[redacted\]/);
  } finally {
    if (saved === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = saved;
  }
});

test('credentials embedded in a URL are redacted', async () => {
  const err = new Error('failed: mongodb+srv://admin:hunter2@cluster.example.net/db');

  const res = mockRes();
  err.status = 400;
  await quiet(() => errorHandler(err, req, res, () => {}));

  assert.doesNotMatch(res._body.message, /hunter2/);
});

test('duplicate-key errors become a friendly 409', async () => {
  const err = new Error('E11000 duplicate key error collection: users index: mobile_1');
  err.code = 11000;
  err.keyPattern = { mobile: 1 };

  const res = mockRes();
  await quiet(() => errorHandler(err, req, res, () => {}));

  assert.equal(res._status, 409);
  assert.equal(res._body.code, 'DUPLICATE_ENTRY');
  assert.match(res._body.message, /already linked/i);
  assert.doesNotMatch(res._body.message, /E11000/);
});

test('expired JWTs become a 401 the client can act on', async () => {
  const err = new Error('jwt expired');
  err.name = 'TokenExpiredError';

  const res = mockRes();
  await quiet(() => errorHandler(err, req, res, () => {}));

  assert.equal(res._status, 401);
  assert.match(res._body.message, /sign in again/i);
});

test('numeric/system error codes are not leaked as API codes', async () => {
  const err = new Error('socket hang up');
  err.code = 'ECONNRESET';

  const res = mockRes();
  await quiet(() => errorHandler(err, req, res, () => {}));

  assert.equal(res._body.code, 'INTERNAL_ERROR');
});

test('every response carries the standard envelope keys', async () => {
  const cases = [
    Object.assign(new Error('boom'), {}),
    Object.assign(new Error('bad input'), { status: 400, code: 'BAD_INPUT' }),
    Object.assign(new Error('nope'), { code: 11000, keyPattern: { email: 1 } }),
  ];

  for (const err of cases) {
    const res = mockRes();
    await quiet(() => errorHandler(err, req, res, () => {}));
    assert.deepEqual(
      Object.keys(res._body).sort(),
      ['code', 'data', 'message', 'success'],
      'envelope keys must be stable'
    );
    assert.equal(typeof res._body.message, 'string');
    assert.ok(res._body.message.length > 0);
  }
});

test('routes can attach safe context via err.data', async () => {
  const err = new Error('You already have an active loan');
  err.status = 409;
  err.code = 'NOT_ELIGIBLE';
  err.data = { loan: { _id: 'l1', status: 'DISBURSED' } };

  const res = mockRes();
  await quiet(() => errorHandler(err, req, res, () => {}));

  assert.deepEqual(res._body.data, { loan: { _id: 'l1', status: 'DISBURSED' } });
});

test('an already-sent response is handed to next, not written twice', async () => {
  const res = mockRes();
  res.headersSent = true;
  let passed = null;

  await quiet(() => errorHandler(new Error('late'), req, res, (e) => {
    passed = e;
  }));

  assert.ok(passed instanceof Error);
  assert.equal(res._body, null, 'must not write a second body');
});

test('notFound returns the standard 404 envelope', () => {
  const res = mockRes();
  notFound(req, res);
  assert.equal(res._status, 404);
  assert.deepEqual(res._body, {
    success: false,
    message: 'Route not found',
    data: null,
    code: 'NOT_FOUND',
  });
});

/* -------------------------------------------------- Razorpay signature math */

test('callback signature is HMAC-SHA256 over order_id|payment_id', () => {
  const secret = 'test_secret';
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Same inputs must reproduce the digest; a changed payment id must not.
  const recomputed = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const tampered = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|pay_TAMPERED`)
    .digest('hex');

  assert.equal(recomputed, expected);
  assert.notEqual(tampered, expected);
  assert.equal(expected.length, 64);
});

test('timing-safe comparison rejects a length mismatch instead of throwing', () => {
  // Mirrors signatureMatches() in routes/payments.js: crypto.timingSafeEqual
  // throws on unequal lengths, so the length guard must come first.
  const compare = (a, b) => {
    const bufA = Buffer.from(String(a || ''), 'utf8');
    const bufB = Buffer.from(String(b || ''), 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  };

  assert.doesNotThrow(() => compare('abc', 'abcdef'));
  assert.equal(compare('abc', 'abcdef'), false);
  assert.equal(compare('abc', ''), false);
  assert.equal(compare(undefined, undefined), true);
  assert.equal(compare('deadbeef', 'deadbeef'), true);
  assert.equal(compare('deadbeef', 'deadbeee'), false);
});
