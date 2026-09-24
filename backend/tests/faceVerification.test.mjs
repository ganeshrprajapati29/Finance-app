import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractAadhaarFaceImage,
  faceMatchPassed,
  livenessPassed,
} from '../src/utils/faceVerification.js';

test('liveness accepts successful SignCare-style status and score', () => {
  assert.equal(livenessPassed({ data: { status: 'SUCCESS', livenessScore: 88 } }), true);
  assert.equal(livenessPassed({ success: true, statusCode: 100, message: 'Valid Authentication' }), true);
  assert.equal(livenessPassed({ data: { status: 'SUCCESS', multipleFacesDetected: true } }), false);
  assert.equal(livenessPassed({ data: { isLive: true, reviewNeeded: 'true' } }), false);
});

test('face match accepts matched status and rejects low score', () => {
  assert.equal(faceMatchPassed({ response: { result: 'MATCHED' } }), true);
  assert.equal(faceMatchPassed({ success: true, statusCode: 100, message: 'Valid Authentication' }), true);
  assert.equal(faceMatchPassed({ data: { matchScore: 41 } }), false);
});

test('extracts Aadhaar photo from normalized or raw DigiLocker response', () => {
  assert.equal(extractAadhaarFaceImage({ photoBase64: 'data:image/jpeg;base64,ABC123' }), 'ABC123');
  assert.equal(extractAadhaarFaceImage({ raw: { data: { pht: 'XYZ789' } } }), 'XYZ789');
});
