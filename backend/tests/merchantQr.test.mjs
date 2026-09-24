import test from 'node:test';
import assert from 'node:assert/strict';

import { merchantPayUrl, merchantQrImageDataUrl, merchantUpiPayload, merchantVelxapayQrPayload } from '../src/utils/merchantQr.js';

test('merchantPayUrl builds public merchant payment URL', () => {
  assert.equal(merchantPayUrl('KPB123'), 'https://khatupay.com/pay/merchant/KPB123');
});

test('merchantPayUrl encodes unsafe public ids', () => {
  assert.equal(merchantPayUrl('KPB 123'), 'https://khatupay.com/pay/merchant/KPB%20123');
});

test('merchantUpiPayload builds a direct UPI QR payload', () => {
  process.env.UPI_DEFAULT_VPA = 'merchant@upi';
  process.env.UPI_PAYEE_NAME = 'Khatu Pay';
  const payload = merchantUpiPayload({ publicId: 'KPB123', businessName: 'Demo Store' });
  assert.equal(payload.startsWith('upi://pay?'), true);
  assert.match(payload, /pa=merchant%40upi/);
  assert.match(payload, /pn=Khatu\+Pay/);
  assert.match(payload, /tr=KPB123/);
  assert.match(payload, /tn=Khatu\+Pay\+Demo\+Store\+KPB123/);
});

test('merchantQrImageDataUrl renders a scannable PNG data URL', async () => {
  const image = await merchantQrImageDataUrl('upi://pay?pa=merchant%40upi&pn=Khatu+Pay&cu=INR&tr=KPB123');
  assert.match(image, /^data:image\/png;base64,/);
  assert.ok(image.length > 1000);
});

test('merchantVelxapayQrPayload points QR scans to the VelxaPay-backed public payment page', () => {
  assert.equal(merchantVelxapayQrPayload({ publicId: 'KPB123' }), 'https://khatupay.com/pay/merchant/KPB123');
});
