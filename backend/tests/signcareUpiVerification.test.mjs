import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSigncareUpiName } from '../src/utils/signcareUpiVerification.js';

test('SignCare UPI ID to Name success response verifies beneficiary name', () => {
  const parsed = normalizeSigncareUpiName({
    data: {
      beneficiary_name: 'GANESH PRAJAPATI',
    },
    messages: [],
    request_id: '1506bbad-f821-47d6-8056-2e2969b1bd46',
    success: true,
    statusCode: 100,
    message: 'Valid Authentication',
  }, { upiId: '9140718388@ptsbi' });

  assert.equal(parsed.isValid, true);
  assert.equal(parsed.status, 'VERIFIED');
  assert.equal(parsed.accountName, 'GANESH PRAJAPATI');
  assert.equal(parsed.beneficiary_name, 'GANESH PRAJAPATI');
  assert.equal(parsed.upiId, '9140718388@ptsbi');
  assert.equal(parsed.statusCode, 100);
  assert.equal(parsed.requestId, '1506bbad-f821-47d6-8056-2e2969b1bd46');
});

test('SignCare UPI ID to Name missing beneficiary name blocks verification', () => {
  const parsed = normalizeSigncareUpiName({
    data: {},
    success: true,
    statusCode: 100,
    message: 'Valid Authentication',
  }, { upiId: '9140718388@ptsbi' });

  assert.equal(parsed.isValid, false);
  assert.equal(parsed.status, 'FAILED');
});
