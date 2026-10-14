// Merchant "Connect Razorpay" (OAuth) flow end to end against a throwaway mongod
// and a fake Razorpay (global fetch is intercepted).
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

test('merchant connects Razorpay, token is refreshed, QR is created once and payments sync', { skip: !available && 'mongod not installed', timeout: 120_000 }, async (t) => {
  const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-connect-e2e-'));
  const mongoPort = await freePort();
  const mongod = spawn(MONGOD, ['--dbpath', dbPath, '--port', String(mongoPort), '--bind_ip', '127.0.0.1', '--quiet'], { stdio: 'ignore' });
  t.after(() => { mongod.kill(); setTimeout(() => fs.rmSync(dbPath, { recursive: true, force: true }), 1500); });

  Object.assign(process.env, {
    JWT_ACCESS_SECRET: 'e2e-jwt', RAZORPAY_PARTNER_CLIENT_ID: 'client', RAZORPAY_PARTNER_CLIENT_SECRET: 'secret',
    RAZORPAY_PARTNER_MODE: 'test', RAZORPAY_PARTNER_OAUTH_REDIRECT_URI: 'https://khatupay.com/api/merchant-business/razorpay/oauth/callback',
    MERCHANT_ONBOARDING_MODE: 'oauth', MAIL_HOST: '127.0.0.1', MAIL_PORT: '9', MAIL_USER: 'x', MAIL_PASS: 'x',
  });

  const calls = { exchange: 0, refresh: 0, qr: 0 };
  const realFetch = globalThis.fetch;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input?.url || input);
    if (!url.includes('razorpay.com')) return realFetch(input, init);
    const method = String(init.method || 'GET').toUpperCase();
    const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
    if (url === 'https://auth.razorpay.com/token') {
      if (body.grant_type === 'authorization_code') {
        calls.exchange += 1;
        assert.equal(body.code, 'auth-code-1');
        // Already expired, so the first API call must refresh it.
        return json(200, { access_token: 'merchant-token-1', refresh_token: 'refresh-1', razorpay_account_id: 'acc_MERCHANT1', expires_in: 1 });
      }
      if (body.grant_type === 'refresh_token') {
        calls.refresh += 1;
        assert.equal(body.refresh_token, 'refresh-1');
        return json(200, { access_token: 'merchant-token-2', refresh_token: 'refresh-2', expires_in: 3600 });
      }
      return json(200, { access_token: 'partner-token', expires_in: 3600 });
    }
    if (url.endsWith('/v1/payments/qr_codes') && method === 'POST') {
      calls.qr += 1;
      assert.equal(init.headers.Authorization, 'Bearer merchant-token-2');
      assert.equal(init.headers['X-Razorpay-Account'], undefined);
      return json(200, { id: 'qr_CONNECT1', image_url: 'https://rzp.io/i/qrCONNECT', status: 'active' });
    }
    if (url.includes('/v1/payments/qr_codes/qr_CONNECT1/payments')) {
      assert.equal(init.headers.Authorization, 'Bearer merchant-token-2');
      return json(200, { items: [{ id: 'pay_1', amount: 25000, currency: 'INR', status: 'captured', acquirer_data: { rrn: '123456789012' } }] });
    }
    return json(404, { error: { description: `unexpected ${method} ${url}` } });
  };
  t.after(() => { globalThis.fetch = realFetch; });

  const mongoose = (await import('mongoose')).default;
  for (let attempt = 0; ; attempt += 1) {
    try { await mongoose.connect(`mongodb://127.0.0.1:${mongoPort}/kp_connect_e2e`, { serverSelectionTimeoutMS: 1000 }); break; } catch (error) {
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
  const User = (await import('../src/models/User.js')).default;
  const MerchantBusiness = (await import('../src/models/MerchantBusiness.js')).default;
  const MerchantPayment = (await import('../src/models/MerchantPayment.js')).default;

  const app = express();
  app.use(express.json());
  app.use('/api/merchant-business', merchantBusiness);
  app.use('/api/merchant-qr', merchantQr);
  app.use(errorHandler);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const owner = await User.create({ name: 'Sunita Devi', email: 'sunita@example.com', mobile: '9876543211', kyc: { panVerified: true, aadhaarVerified: true, panNumber: 'ABCDE1234F' } });
  const unverified = await User.create({ name: 'New User', email: 'new@example.com', mobile: '9876543212' });
  const call = async (method, url, { user = owner, body } = {}) => {
    const response = await realFetch(`${base}${url}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ uid: String(user._id), sv: 0 }, 'e2e-jwt')}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  const profile = (name, mobile, email) => ({ businessName: name, ownerName: 'Owner', category: 'Food and beverages', mobile, email, address: 'Jaipur' });
  const statusOf = (dashboard, key) => dashboard.onboarding.steps.find((step) => step.key === key)?.status;

  // 1. Connect mode has four steps and needs no bank or business form.
  assert.equal((await call('POST', '/api/merchant-business', { body: profile('Sunita Tiffin Centre', '9876543211', 'sunita@example.com') })).status, 201);
  let me = (await call('GET', '/api/merchant-business/me')).body.data;
  assert.equal(me.onboarding.mode, 'oauth');
  assert.deepEqual(me.onboarding.steps.map((step) => step.key), ['profile', 'personalKyc', 'activation', 'qr']);
  assert.equal(me.onboarding.nextStep, 'activation');
  assert.equal((await call('POST', '/api/merchant-qr')).body.code, 'PRODUCT_NOT_ACTIVE');

  // 2. Owner KYC comes first.
  await call('POST', '/api/merchant-business', { user: unverified, body: profile('New Shop', '9876543212', 'new@example.com') });
  const early = await call('POST', '/api/merchant-business/razorpay/oauth/start', { user: unverified });
  assert.equal(early.status, 409);
  assert.equal(early.body.code, 'PERSONAL_KYC_REQUIRED');

  // 3. Start -> Razorpay page -> callback.
  const start = await call('POST', '/api/merchant-business/razorpay/oauth/start');
  assert.equal(start.status, 200, JSON.stringify(start.body));
  const authorizeUrl = new URL(start.body.data.authorizationUrl);
  assert.equal(authorizeUrl.origin, 'https://auth.razorpay.com');
  assert.equal(authorizeUrl.searchParams.get('mode'), 'test');
  const state = authorizeUrl.searchParams.get('state');

  const wrong = await realFetch(`${base}/api/merchant-business/razorpay/oauth/callback?code=auth-code-1&state=not-the-state`, { redirect: 'manual' });
  assert.equal(wrong.status, 303);
  assert.match(wrong.headers.get('location'), /status=failed/);
  const cancelled = await realFetch(`${base}/api/merchant-business/razorpay/oauth/callback?error=access_denied&state=${state}`, { redirect: 'manual' });
  assert.match(cancelled.headers.get('location'), /status=failed.*cancelled/);
  assert.equal(calls.exchange, 0);

  const done = await realFetch(`${base}/api/merchant-business/razorpay/oauth/callback?code=auth-code-1&state=${state}`, { redirect: 'manual' });
  assert.equal(done.status, 303);
  assert.match(done.headers.get('location'), /loan-signing-complete\?flow=razorpay&status=completed$/);
  // The one-time state cannot be replayed.
  const replay = await realFetch(`${base}/api/merchant-business/razorpay/oauth/callback?code=auth-code-1&state=${state}`, { redirect: 'manual' });
  assert.match(replay.headers.get('location'), /status=failed/);
  assert.equal(calls.exchange, 1);

  me = (await call('GET', '/api/merchant-business/me')).body.data;
  assert.equal(statusOf(me, 'activation'), 'DONE');
  assert.equal(me.onboarding.canCreateQr, true);
  assert.equal(me.business.status, 'APPROVED');
  assert.equal(me.business.razorpay.oauthAccessToken, undefined, 'tokens never leave the server');
  const stored = await MerchantBusiness.findOne({ userId: owner._id }).lean();
  assert.notEqual(stored.razorpay.oauthAccessToken, 'merchant-token-1', 'token is encrypted at rest');
  assert.equal(stored.razorpay.accountId, 'acc_MERCHANT1');

  // 4. QR with the merchant's own (refreshed) token; a second tap reuses it.
  const qr = await call('POST', '/api/merchant-qr');
  assert.equal(qr.status, 200, JSON.stringify(qr.body));
  assert.equal(qr.body.data.providerQrId, 'qr_CONNECT1');
  assert.equal((await call('POST', '/api/merchant-qr')).status, 200);
  assert.deepEqual(calls, { exchange: 1, refresh: 1, qr: 1 });
  me = (await call('GET', '/api/merchant-business/me')).body.data;
  assert.equal(me.onboarding.progress, 100);
  assert.equal(me.onboarding.qrActive, true);

  // 5. Payments received on the QR are pulled in.
  const sync = await call('POST', '/api/merchant-qr/sync-payments');
  assert.equal(sync.status, 200, JSON.stringify(sync.body));
  const payment = await MerchantPayment.findOne({ orderId: 'pay_1' }).lean();
  assert.equal(payment.amount, 250);
  assert.equal(payment.status, 'SUCCESS');

  // 6. Refresh status is harmless for a connected merchant.
  const refresh = await call('POST', '/api/merchant-business/razorpay/sync');
  assert.equal(refresh.status, 200);
});
