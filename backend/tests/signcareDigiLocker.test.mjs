import test from 'node:test';
import assert from 'node:assert/strict';
import dns from 'dns';

import { buildDigiLockerInitPayload, signcareIpv4Lookup } from '../src/services/signcare.js';
import { compactDigiLockerData, digilockerAadhaarData, digilockerComplete } from '../src/routes/loanVerification.js';

test('DigiLocker init payload matches SignCare OpenAPI field casing', () => {
  const payload = buildDigiLockerInitPayload({
    mobileNumber: '9876543210',
    consentText: 'Identity verification consent',
    requestId: 'KP-DIGILOCKER-TEST',
  });

  assert.equal(payload.mobileNumber, '9876543210');
  assert.equal('mobile_number' in payload, false);
  assert.equal(payload.consent, 'Y');
  assert.equal(payload.consent_text, 'Identity verification consent');
  assert.equal(payload.request_id, 'KP-DIGILOCKER-TEST');
  assert.deepEqual(payload.docs, ['ADHAR']);
  assert.equal(payload.using_aadhaar, false);
  assert.equal(payload.webhookUrl.length > 0, true);
  // The app's WebView closes on this URL, so it must be our completion page.
  assert.match(payload.redirectUrl, /loan-signing-complete/);
  assert.match(payload.redirectUrl, /status=completed/);
});

const detailsResponse = {
  transactionId: 'TXN-1',
  docs: [{
    docType: 'ADHAR',
    status: 'FETCHED',
    dataPdf: 'A'.repeat(5000),
    dataXml: '<xml/>',
    details: {
      name: 'Ramesh Kumar',
      dob: '01-01-1990',
      gender: 'M',
      address: 'House 1, Jaipur, Rajasthan 302001',
      pinCode: '302001',
      state: 'Rajasthan',
      aadhaarNumber: 'XXXXXXXX1234',
      photo: 'cGhvdG8=',
    },
  }],
};

test('DigiLocker details map to Aadhaar claims without the raw eAadhaar files', () => {
  assert.equal(digilockerComplete(detailsResponse), true);
  const claims = digilockerAadhaarData(detailsResponse);
  assert.equal(claims.fullName, 'Ramesh Kumar');
  assert.equal(claims.maskedAadhaar, 'XXXXXXXX1234');
  assert.equal(claims.pincode, '302001');
  assert.equal(claims.photoBase64, 'cGhvdG8=');
  assert.equal(JSON.stringify(claims).includes('AAAAAAAAAA'), false);
  assert.equal('dataXml' in compactDigiLockerData(detailsResponse).docs[0], false);
});

test('DigiLocker session without documents stays pending', () => {
  assert.equal(digilockerComplete({ transactionId: 'TXN-1', docs: [] }), false);
  assert.equal(digilockerComplete({ transactionId: 'TXN-1', docs: [{ docType: 'ADHAR', status: 'PENDING' }] }), false);
});

test('SignCare lookup uses DNS answers, not a pinned hosts entry', async (t) => {
  t.mock.method(dns, 'resolve4', (_host, cb) => cb(null, ['3.7.131.138']));
  const lookupSpy = t.mock.method(dns, 'lookup', (_h, _o, cb) => cb(null, '13.200.111.121', 4));

  const single = await new Promise((resolve, reject) => signcareIpv4Lookup('ext.signcare.io', {}, (e, a, f) => (e ? reject(e) : resolve([a, f]))));
  assert.deepEqual(single, ['3.7.131.138', 4]);

  const all = await new Promise((resolve, reject) => signcareIpv4Lookup('ext.signcare.io', { all: true }, (e, a) => (e ? reject(e) : resolve(a))));
  assert.deepEqual(all, [{ address: '3.7.131.138', family: 4 }]);
  assert.equal(lookupSpy.mock.callCount(), 0);
});

test('SignCare lookup falls back to the OS resolver when DNS fails', async (t) => {
  t.mock.method(dns, 'resolve4', (_host, cb) => cb(Object.assign(new Error('fail'), { code: 'ESERVFAIL' })));
  t.mock.method(dns, 'lookup', (_h, options, cb) => cb(null, '10.0.0.1', options.family));
  const single = await new Promise((resolve) => signcareIpv4Lookup('ext.signcare.io', {}, (_e, a, f) => resolve([a, f])));
  assert.deepEqual(single, ['10.0.0.1', 4]);
});
