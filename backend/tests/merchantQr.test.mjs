import test from 'node:test';
import assert from 'node:assert/strict';

import { mapRazorpayAccountStatus } from '../src/services/razorpayPartner.js';

test('Razorpay sub-merchant statuses map to local business states', () => {
  assert.equal(mapRazorpayAccountStatus('created'), 'SUBMITTED');
  assert.equal(mapRazorpayAccountStatus('under_review'), 'UNDER_REVIEW');
  assert.equal(mapRazorpayAccountStatus('needs_clarification'), 'NEEDS_CLARIFICATION');
  assert.equal(mapRazorpayAccountStatus('activated'), 'APPROVED');
  assert.equal(mapRazorpayAccountStatus('rejected'), 'REJECTED');
  assert.equal(mapRazorpayAccountStatus('suspended'), 'SUSPENDED');
});

test('unknown provider states remain safely non-active', () => {
  assert.equal(mapRazorpayAccountStatus('unexpected_state'), 'SUBMITTED');
});
