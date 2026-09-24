import test from 'node:test';
import assert from 'node:assert/strict';

import { friendlyVerificationMessage } from '../src/utils/friendlyProviderErrors.js';

test('maps provider authentication text to a safe service message', () => {
  assert.equal(
    friendlyVerificationMessage('Invalid API key supplied', { service: 'bank' }),
    'Verification service is temporarily unavailable. Please try again later.',
  );
});

test('maps failed bank and face verification text to actionable messages', () => {
  assert.equal(
    friendlyVerificationMessage('Bank transaction failed', { service: 'bank' }),
    'Bank account could not be verified. Please check the account number and IFSC.',
  );
  assert.equal(
    friendlyVerificationMessage('face mismatch detected', { service: 'face' }),
    'Face match failed. Please use a clear selfie and complete Aadhaar verification again if needed.',
  );
});
