/**
 * Payment gateway helpers: paise conversion, env guards and the standard
 * response envelope.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { toPaise, missingRazorpayEnv, razorpayRefundState } from '../src/services/razorpay.js';
import { ok, fail, created } from '../src/utils/response.js';

const mockRes = () => ({
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

/* --------------------------------------------------------------- toPaise */

test('rupees convert to integer paise', () => {
  assert.equal(toPaise(1), 100);
  assert.equal(toPaise(100), 10000);
  assert.equal(toPaise(1999), 199900);
});

test('fractional rupees round rather than truncate', () => {
  // The float-drift case: 1234.56 * 100 is 123455.99999999999 in IEEE754.
  // Truncating would silently under-charge by a paisa on every such amount.
  assert.equal(toPaise(1234.56), 123456);
  assert.equal(toPaise(0.1 + 0.2), 30);
  assert.equal(toPaise(19.99), 1999);
  assert.equal(toPaise('4999.50'), 499950);
});

test('paise are always a safe integer', () => {
  for (const amount of [1234.56, 0.05, 99999.99, 7.7]) {
    const paise = toPaise(amount);
    assert.ok(Number.isSafeInteger(paise), `${amount} -> ${paise} must be an integer`);
  }
});

test('invalid amounts are rejected with a 400-shaped error', () => {
  for (const bad of [0, -1, NaN, Infinity, null, undefined, 'abc', '']) {
    assert.throws(
      () => toPaise(bad),
      (err) => err.status === 400 && err.code === 'INVALID_AMOUNT',
      `${String(bad)} should be rejected`
    );
  }
});

/* ------------------------------------------------------------- env guards */

test('missing Razorpay credentials are reported by name', () => {
  const saved = {
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  };
  try {
    delete process.env.RAZORPAY_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = '   '; // whitespace counts as missing
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    assert.deepEqual(missingRazorpayEnv(), [
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
    ]);
    assert.deepEqual(missingRazorpayEnv({ requireWebhook: true }), [
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
    ]);

    process.env.RAZORPAY_KEY_ID = 'rzp_test_x';
    process.env.RAZORPAY_KEY_SECRET = 'secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'hook';
    assert.deepEqual(missingRazorpayEnv({ requireWebhook: true }), []);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

/* ---------------------------------------------------------- response shape */

test('ok() always returns the standard envelope', () => {
  const res = mockRes();
  ok(res, { id: 1 }, 'Fetched');
  assert.equal(res._status, 200);
  assert.deepEqual(res._body, {
    success: true,
    message: 'Fetched',
    data: { id: 1 },
  });
});

test('ok() normalises undefined data to null', () => {
  const res = mockRes();
  ok(res, undefined);
  assert.equal(res._body.data, null);
  assert.equal(res._body.success, true);
});

test('ok() carries an optional machine-readable code', () => {
  const res = mockRes();
  ok(res, { order: 'x' }, 'Order created', { code: 'ORDER_CREATED' });
  assert.equal(res._body.code, 'ORDER_CREATED');
});

test('created() responds 201 with the same envelope', () => {
  const res = mockRes();
  created(res, { loanId: 'l1' }, 'Submitted', { code: 'LOAN_APPLICATION_SUBMITTED' });
  assert.equal(res._status, 201);
  assert.equal(res._body.success, true);
  assert.equal(res._body.code, 'LOAN_APPLICATION_SUBMITTED');
});

test('fail() keeps data present so clients never special-case errors', () => {
  const res = mockRes();
  fail(res, 'LOAN_NOT_FOUND', 'Loan not found', 404);
  assert.equal(res._status, 404);
  assert.deepEqual(res._body, {
    success: false,
    message: 'Loan not found',
    data: null,
    code: 'LOAN_NOT_FOUND',
  });
});

test('fail() can carry context, e.g. the blocking loan', () => {
  const res = mockRes();
  fail(res, 'NOT_ELIGIBLE', 'You already have a loan', 409, { loan: { _id: 'l1' } });
  assert.equal(res._status, 409);
  assert.deepEqual(res._body.data, { loan: { _id: 'l1' } });
});

/* ------------------------------------------------------ gateway errors */

import { describeRazorpayError, isRazorpaySdkError, toPaymentGatewayError } from '../src/services/razorpay.js';

test('Razorpay SDK errors are recognised and described without secrets', () => {
  const sdkError = { statusCode: 401, error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' } };
  assert.equal(isRazorpaySdkError(sdkError), true);
  assert.equal(isRazorpaySdkError(new Error('x')), false);
  assert.equal(isRazorpaySdkError({ statusCode: 500 }), false);

  const info = describeRazorpayError(sdkError);
  assert.equal(info.authFailed, true);
  assert.equal(info.httpStatus, 401);

  const { error } = console;
  console.error = () => {};
  try {
    const gatewayError = toPaymentGatewayError(sdkError);
    assert.equal(gatewayError.status, 502);
    assert.equal(gatewayError.code, 'PAYMENT_GATEWAY_ERROR');
    assert.equal(gatewayError.expose, true);
    assert.match(gatewayError.message, /gateway authentication failed/);
  } finally {
    console.error = error;
  }
});

test('partial Razorpay refunds do not mark the whole payment refunded', () => {
  assert.deepEqual(razorpayRefundState(100, 2500), {
    paymentPaise: 10000,
    totalRefundedPaise: 2500,
    fullyRefunded: false,
  });
});

test('cumulative Razorpay refunds become full at the original payment amount', () => {
  assert.equal(razorpayRefundState(100, 9999).fullyRefunded, false);
  assert.equal(razorpayRefundState(100, 10000).fullyRefunded, true);
  assert.equal(razorpayRefundState(100, 11000).fullyRefunded, true);
});

test('invalid Razorpay refund amounts are rejected', () => {
  for (const bad of [-1, 1.5, NaN, Infinity]) {
    assert.throws(
      () => razorpayRefundState(100, bad),
      (err) => err.status === 400 && err.code === 'INVALID_REFUND_AMOUNT'
    );
  }
});
