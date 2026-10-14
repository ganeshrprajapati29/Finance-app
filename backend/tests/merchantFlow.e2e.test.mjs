// Merchant onboarding end to end against a throwaway mongod and a fake Razorpay
// (global fetch is intercepted; nothing reaches the real provider).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const MONGOD = process.env.MONGOD_PATH || 'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe';
const available = fs.existsSync(MONGOD);
const freePort = () => new Promise((resolve) => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
});

test('merchant onboarding: queued while Razorpay access is denied, resumes without re-entry, then QR', { skip: !available && 'mongod not installed', timeout: 120_000 }, async (t) => {
  const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-merchant-e2e-'));
  const mongoPort = await freePort();
  const mongod = spawn(MONGOD, ['--dbpath', dbPath, '--port', String(mongoPort), '--bind_ip', '127.0.0.1', '--quiet'], { stdio: 'ignore' });
  t.after(() => { mongod.kill(); setTimeout(() => fs.rmSync(dbPath, { recursive: true, force: true }), 1500); });

  Object.assign(process.env, {
    JWT_ACCESS_SECRET: 'e2e-jwt', RAZORPAY_PARTNER_CLIENT_ID: 'client', RAZORPAY_PARTNER_CLIENT_SECRET: 'secret',
    RAZORPAY_PARTNER_MODE: 'test', MERCHANT_ONBOARDING_MODE: 'api', RAZORPAY_PARTNER_KEY_ID: 'rzp_test_partner', RAZORPAY_PARTNER_KEY_SECRET: 'partner-secret', RAZORPAY_PARTNER_WEBHOOK_SECRET: 'hook-secret', SIGNCARE_BASE_URL: 'http://127.0.0.1:9', SIGNCARE_API_KEY: 'k', SIGNCARE_APP_ID: 'a',
    MAIL_HOST: '127.0.0.1', MAIL_PORT: '9', MAIL_USER: 'x', MAIL_PASS: 'x',
  });

  // ---- fake Razorpay ----------------------------------------------------------------
  const provider = { accessDenied: true, productStatus: 'needs_clarification', calls: { account: 0, stakeholder: 0, product: 0, settlement: 0, qr: 0 } };
  const realFetch = globalThis.fetch;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input?.url || input);
    if (!url.includes('razorpay.com')) return realFetch(input, init);
    const method = String(init.method || 'GET').toUpperCase();
    const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
    if (url === 'https://auth.razorpay.com/token') return json(200, { access_token: 'tok', expires_in: 3600 });
    if (url.endsWith('/v2/products/payments/tnc')) return json(200, { id: 'tnc_1', tnc: { terms: 'https://razorpay.com/terms/' }, last_published_at: 1641541561 });
    if (url.endsWith('/v2/accounts') && method === 'POST') {
      if (provider.accessDenied) return json(400, { error: { code: 'BAD_REQUEST_ERROR', description: 'Access Denied' } });
      provider.calls.account += 1;
      // Sub-merchant APIs use the partner's own API keys.
      assert.equal(init.headers.Authorization, `Basic ${Buffer.from('rzp_test_partner:partner-secret').toString('base64')}`);
      assert.equal(body.legal_info.gst, '08ABCDE1234F1Z5');
      assert.equal(body.profile.addresses.registered.state, 'RAJASTHAN');
      return json(200, { id: 'acc_TEST1', status: 'created', requirements: [] });
    }
    if (/\/v2\/accounts\/acc_TEST1\/stakeholders$/.test(url)) { provider.calls.stakeholder += 1; return json(200, { id: 'sth_1' }); }
    if (/\/v2\/accounts\/acc_TEST1\/products$/.test(url)) {
      provider.calls.product += 1;
      return json(200, { id: 'acc_prd_1', status: 'needs_clarification', requirements: [{ field_reference: 'settlements.account_number', reason_code: 'field_missing', status: 'required' }] });
    }
    if (/\/v2\/accounts\/acc_TEST1\/products\/acc_prd_1$/.test(url)) {
      if (method === 'PATCH') { provider.calls.settlement += 1; return json(200, { id: 'acc_prd_1', status: 'under_review', requirements: [] }); }
      return json(200, { id: 'acc_prd_1', status: provider.productStatus, requirements: [] });
    }
    if (/\/v2\/accounts\/acc_TEST1$/.test(url)) return json(200, { id: 'acc_TEST1', status: provider.productStatus === 'activated' ? 'activated' : 'under_review', requirements: [] });
    if (url.endsWith('/v1/payments/qr_codes') && method === 'POST') {
      provider.calls.qr += 1;
      assert.equal(init.headers['X-Razorpay-Account'], 'acc_TEST1');
      assert.match(init.headers.Authorization, /^Basic /);
      return json(200, { id: 'qr_TEST1', image_url: 'https://rzp.io/i/qrTEST', status: 'active' });
    }
    return json(404, { error: { description: `unexpected ${method} ${url}` } });
  };
  t.after(() => { globalThis.fetch = realFetch; });

  const mongoose = (await import('mongoose')).default;
  for (let attempt = 0; ; attempt += 1) {
    try { await mongoose.connect(`mongodb://127.0.0.1:${mongoPort}/kp_merchant_e2e`, { serverSelectionTimeoutMS: 1000 }); break; } catch (error) {
      if (attempt > 30) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  t.after(() => mongoose.disconnect());

  const express = (await import('express')).default;
  const jwt = (await import('jsonwebtoken')).default;
  const { errorHandler } = await import('../src/middlewares/errorHandler.js');
  const merchantBusiness = (await import('../src/routes/merchantBusiness.js')).default;
  const merchantQr = (await import('../src/routes/merchantQr.js')).default;
  const adminMerchant = (await import('../src/routes/adminMerchantBusinesses.js')).default;
  const User = (await import('../src/models/User.js')).default;
  const MerchantBusiness = (await import('../src/models/MerchantBusiness.js')).default;
  const MerchantBankAccount = (await import('../src/models/MerchantBankAccount.js')).default;
  const { retryQueuedMerchantOnboarding } = await import('../src/jobs/merchantOnboardingRetryJob.js');

  const app = express();
  app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = Buffer.from(buf); } }));
  const partnerWebhook = (await import('../src/routes/razorpayPartnerWebhook.js')).default;
  app.use('/api/webhooks/razorpay/partner', partnerWebhook);
  app.use('/api/merchant-business', merchantBusiness);
  app.use('/api/merchant-qr', merchantQr);
  app.use('/api/admin/merchant-businesses', adminMerchant);
  app.use(errorHandler);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const owner = await User.create({ name: 'Ramesh Kumar', email: 'ramesh@example.com', mobile: '9876543210', kyc: { panVerified: true, aadhaarVerified: true, panNumber: 'ABCDE1234F' } });
  const admin = await User.create({ name: 'Admin', email: 'admin@example.com', mobile: '9876500000', roles: ['user', 'admin'] });
  const call = async (method, url, { user = owner, body } = {}) => {
    const response = await realFetch(`${base}${url}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ uid: String(user._id), sv: 0 }, 'e2e-jwt')}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  const stepStatus = (dashboard, key) => dashboard.onboarding.steps.find((step) => step.key === key)?.status;

  // 0. No business yet: the dashboard still explains the first step.
  const empty = await call('GET', '/api/merchant-business/me');
  assert.equal(empty.body.data.business, null);
  assert.equal(empty.body.data.onboarding.nextStep, 'profile');

  // 1. Profile.
  const created = await call('POST', '/api/merchant-business', { body: { businessName: 'Balaji Kirana', ownerName: 'Ramesh Kumar', category: 'Retail store', mobile: '9876543210', email: 'ramesh@example.com', address: 'Jaipur' } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  let me = (await call('GET', '/api/merchant-business/me')).body.data;
  assert.equal(stepStatus(me, 'personalKyc'), 'DONE');
  assert.equal(me.onboarding.nextStep, 'bank');

  // 2. Bank: the verification provider is unreachable -> saved for review, not an error.
  const bank = await call('POST', '/api/merchant-business/bank-account', { body: { accountHolderName: 'Ramesh Kumar', accountNumber: '123456789012', ifscCode: 'HDFC0001234', bankName: 'HDFC Bank' } });
  assert.equal(bank.status, 200, JSON.stringify(bank.body));
  assert.equal(bank.body.data.status, 'REVIEW');
  me = (await call('GET', '/api/merchant-business/me')).body.data;
  assert.equal(stepStatus(me, 'bank'), 'REVIEW');
  assert.equal(me.onboarding.nextStep, 'businessDetails');

  // 3. A badly typed GSTIN gets a clear message; a spaced, lower-case one is accepted.
  const details = {
    legalBusinessName: 'Balaji Kirana Store', customerFacingBusinessName: 'Balaji Kirana', businessType: 'proprietorship',
    businessModel: 'Grocery and daily essentials retail shop', gstNumber: '08abcde 1234f-1z5', termsAccepted: true,
    address: { street1: '12 MG Road', city: 'Jaipur', state: 'RAJASTHAN', postalCode: '302001' },
  };
  const badGst = await call('POST', '/api/merchant-business/razorpay/onboard', { body: { ...details, gstNumber: '08ABCDE1234F1Z5EXTRA' } });
  assert.equal(badGst.status, 400);
  assert.equal(badGst.body.code, 'GSTIN_INVALID');

  // 4. Razorpay denies account creation (today's real state): the application is queued.
  const queued = await call('POST', '/api/merchant-business/razorpay/onboard', { body: details });
  assert.equal(queued.status, 200, JSON.stringify(queued.body));
  assert.equal(queued.body.data.queued, true);
  assert.equal(stepStatus(queued.body.data, 'businessDetails'), 'DONE');
  assert.equal(stepStatus(queued.body.data, 'activation'), 'REVIEW');
  assert.equal(queued.body.data.business.razorpay.lastProviderError, undefined);
  let stored = await MerchantBusiness.findOne({ userId: owner._id }).lean();
  assert.equal(stored.razorpay.providerState, 'QUEUED');
  assert.equal(stored.onboardingRequest.gstNumber, '08ABCDE1234F1Z5');
  assert.equal(provider.calls.account, 0);

  // QR is not offered before activation.
  const earlyQr = await call('POST', '/api/merchant-qr');
  assert.equal(earlyQr.status, 409);
  assert.equal(earlyQr.body.code, 'PRODUCT_NOT_ACTIVE');

  // 5. Admin verifies the bank; provider access is enabled; the retry job sends the
  //    saved application once - no re-entry, no duplicate accounts.
  await MerchantBankAccount.updateOne({ userId: owner._id }, { $set: { status: 'VERIFIED' } });
  provider.accessDenied = false;
  const retried = await retryQueuedMerchantOnboarding();
  assert.equal(retried.submitted, 1);
  await retryQueuedMerchantOnboarding();
  await call('POST', `/api/admin/merchant-businesses/${stored._id}/provider-onboard`, { user: admin });
  assert.deepEqual(provider.calls, { account: 1, stakeholder: 1, product: 1, settlement: 1, qr: 0 });
  stored = await MerchantBusiness.findOne({ userId: owner._id }).lean();
  assert.equal(stored.razorpay.accountId, 'acc_TEST1');
  assert.equal(stored.razorpay.providerState, 'SUBMITTED');
  assert.equal(stored.status, 'UNDER_REVIEW');

  // 6. Razorpay activates the product; the owner refreshes and creates the QR once.
  provider.productStatus = 'activated';
  const synced = await call('POST', '/api/merchant-business/razorpay/sync');
  assert.equal(synced.status, 200, JSON.stringify(synced.body));
  assert.equal(stepStatus(synced.body.data, 'activation'), 'DONE');
  assert.equal(synced.body.data.onboarding.canCreateQr, true);
  const qr = await call('POST', '/api/merchant-qr');
  assert.equal(qr.status, 200, JSON.stringify(qr.body));
  assert.equal(qr.body.data.providerQrId, 'qr_TEST1');
  const again = await call('POST', '/api/merchant-qr');
  assert.equal(again.status, 200);
  assert.equal(provider.calls.qr, 1);
  me = (await call('GET', '/api/merchant-business/me')).body.data;
  assert.equal(me.onboarding.qrActive, true);
  assert.equal(me.onboarding.progress, 100);
  assert.equal(me.onboarding.nextStep, null);

  // 7. Verified webhooks: a QR payment is tied to the business by account_id,
  //    a late "authorized" event cannot undo it, and a bare account event
  //    does not wipe the product.
  const crypto = await import('node:crypto');
  const MerchantPayment = (await import('../src/models/MerchantPayment.js')).default;
  const hook = async (event, secret = 'hook-secret') => {
    const body = JSON.stringify(event);
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return realFetch(`${base}/api/webhooks/razorpay/partner`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': signature }, body });
  };
  const paid = { id: 'pay_QR1', amount: 15000, currency: 'INR', status: 'captured', method: 'upi', acquirer_data: { rrn: '998877665544' } };
  assert.equal((await hook({ event: 'qr_code.credited', account_id: 'acc_TEST1', payload: { payment: { entity: paid }, qr_code: { entity: { id: 'qr_TEST1' } } } })).status, 200);
  assert.equal((await hook({ event: 'payment.authorized', account_id: 'acc_TEST1', payload: { payment: { entity: { ...paid, status: 'authorized' } } } })).status, 200);
  assert.equal((await hook({ event: 'payment.captured', account_id: 'acc_TEST1', payload: { payment: { entity: paid } } }, 'wrong-secret')).status, 400);
  const credited = await MerchantPayment.find({ providerTransactionId: 'pay_QR1' }).lean();
  assert.equal(credited.length, 1);
  assert.equal(credited[0].status, 'SUCCESS');
  assert.equal(credited[0].amount, 150);
  assert.equal(credited[0].utr, '998877665544');
  assert.equal((await hook({ event: 'account.under_review', payload: { account: { entity: { id: 'acc_TEST1', status: 'under_review' } } } })).status, 200);
  stored = await MerchantBusiness.findOne({ userId: owner._id }).lean();
  assert.equal(stored.razorpay.productId, 'acc_prd_1');
  assert.equal(stored.status, 'APPROVED');

  const adminList = await call('GET', '/api/admin/merchant-businesses', { user: admin });
  assert.equal(adminList.body.data[0].onboarding.progress, 100);
});
