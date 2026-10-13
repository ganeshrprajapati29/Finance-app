// End-to-end loan flow against a throwaway mongod, a fake SignCare and a fake
// Cloudinary. Skips when no local mongod binary is available (set MONGOD_PATH).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';

const MONGOD = process.env.MONGOD_PATH || 'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe';
const available = fs.existsSync(MONGOD);

const freePort = () => new Promise((resolve) => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
});

const readBody = (req) => new Promise((resolve) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => resolve(Buffer.concat(chunks)));
});

test('loan flow: idempotent submit, manual review, approval, eSign via webhook, single disbursal', { skip: !available && 'mongod not installed', timeout: 180_000 }, async (t) => {
  // ---- fake SignCare + Cloudinary --------------------------------------------------
  const calls = { eSignRequest: 0, eSignStatus: 0, audit: 0, uploads: 0 };
  const stored = new Map();
  let signed = false;
  let signedPdf = null;
  const fake = http.createServer(async (req, res) => {
    const body = await readBody(req);
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (req.url.includes('/image/upload') || req.url.includes('/auto/upload') || req.url.includes('/raw/upload')) {
      calls.uploads += 1;
      const start = body.indexOf('%PDF');
      const end = body.lastIndexOf('%%EOF');
      const file = start >= 0 && end > start ? body.subarray(start, end + 5) : body;
      const id = `file-${calls.uploads}`;
      stored.set(id, Buffer.from(file));
      return json(200, { secure_url: `http://127.0.0.1:${fake.address().port}/files/${id}`, public_id: id });
    }
    if (req.url.startsWith('/files/')) {
      const file = stored.get(req.url.slice('/files/'.length));
      if (!file) return json(404, {});
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      return res.end(file);
    }
    if (req.url === '/api/v1/eSign/request') {
      calls.eSignRequest += 1;
      const payload = JSON.parse(body.toString());
      assert.equal(payload.userInfo[0].emailId, 'borrower@example.com');
      signedPdf = Buffer.from(payload.documentInfo.content, 'base64');
      return json(200, { success: true, data: { documentId: `DOC-${calls.eSignRequest}`, documentReferenceId: `REF-${calls.eSignRequest}`, userInfo: [{ esignLink: 'https://sign.example/1' }] } });
    }
    if (req.url === '/api/v1/eSign/status') {
      calls.eSignStatus += 1;
      return json(200, { success: true, data: signed
        ? { documentId: 'DOC-1', documentStatus: 'Completed', content: signedPdf.toString('base64'), signerInfo: [{ signerStatus: 'Signed' }] }
        : { documentId: 'DOC-1', documentStatus: 'Pending', signerInfo: [{ signerStatus: 'Pending', esignLink: 'https://sign.example/1' }] } });
    }
    if (req.url.startsWith('/api/v1/eSign/audittrail/')) {
      calls.audit += 1;
      return json(200, { success: true, data: { events: ['signed'] } });
    }
    return json(404, { success: false, message: `unexpected ${req.url}` });
  });
  await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve));
  t.after(() => fake.close());
  const fakeUrl = `http://127.0.0.1:${fake.address().port}`;

  // ---- throwaway mongod --------------------------------------------------------------
  const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-loan-e2e-'));
  const mongoPort = await freePort();
  const mongod = spawn(MONGOD, ['--dbpath', dbPath, '--port', String(mongoPort), '--bind_ip', '127.0.0.1', '--quiet'], { stdio: 'ignore' });
  t.after(() => { mongod.kill(); setTimeout(() => fs.rmSync(dbPath, { recursive: true, force: true }), 1500); });

  Object.assign(process.env, {
    SIGNCARE_BASE_URL: fakeUrl, SIGNCARE_API_KEY: 'k', SIGNCARE_APP_ID: 'a', SIGNCARE_WEBHOOK_SECRET: 'e2e-secret',
    JWT_ACCESS_SECRET: 'e2e-jwt', MAIL_HOST: '127.0.0.1', MAIL_PORT: '9', MAIL_USER: 'x', MAIL_PASS: 'x',
  });
  const mongoose = (await import('mongoose')).default;
  for (let attempt = 0; ; attempt += 1) {
    try { await mongoose.connect(`mongodb://127.0.0.1:${mongoPort}/kp_e2e`, { serverSelectionTimeoutMS: 1000 }); break; } catch (error) {
      if (attempt > 30) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  t.after(() => mongoose.disconnect());

  // Cloudinary's SDK only speaks https, so replace its upload stream with one
  // that keeps the bytes and serves them back from the fake server.
  const cloudinary = (await import('../src/services/cloudinary.js')).default;
  const { Writable } = await import('node:stream');
  cloudinary.uploader.upload_stream = (_options, callback) => {
    const chunks = [];
    return new Writable({
      write(chunk, _encoding, done) { chunks.push(chunk); done(); },
      final(done) {
        calls.uploads += 1;
        const id = `file-${calls.uploads}`;
        stored.set(id, Buffer.concat(chunks));
        callback(null, { secure_url: `${fakeUrl}/files/${id}`, public_id: id });
        done();
      },
    });
  };
  const express = (await import('express')).default;
  const jwt = (await import('jsonwebtoken')).default;
  const { errorHandler } = await import('../src/middlewares/errorHandler.js');
  const loans = (await import('../src/routes/loans.js')).default;
  const adminLoans = (await import('../src/routes/adminLoans.js')).default;
  const webhook = (await import('../src/routes/signcareWebhook.js')).default;
  const User = (await import('../src/models/User.js')).default;
  const Loan = (await import('../src/models/Loan.js')).default;
  const LoanVerification = (await import('../src/models/LoanVerification.js')).default;
  const { syncPendingAgreements } = await import('../src/jobs/agreementSignatureSyncJob.js');
  await Loan.syncIndexes();

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/loans', loans);
  app.use('/api/admin/loans', adminLoans);
  app.use('/api/signcare/webhook', webhook);
  app.use(errorHandler);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const borrower = await User.create({ name: 'Borrower One', email: 'borrower@example.com', mobile: '9876543210' });
  const admin = await User.create({ name: 'Admin', email: 'admin@example.com', mobile: '9876500000', roles: ['user', 'admin'] });
  const tokenFor = (user) => jwt.sign({ uid: String(user._id), sv: 0 }, 'e2e-jwt');
  const call = async (method, url, { user = borrower, body, headers = {} } = {}) => {
    const response = await fetch(`${base}${url}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(user)}`, ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };

  const stage = (status, data = {}) => ({ status, updatedAt: new Date(), ...(status === 'VERIFIED' ? { verifiedAt: new Date() } : {}), data });
  await LoanVerification.create({
    userId: borrower._id,
    consent: { accepted: true, acceptedAt: new Date(), version: 'test' },
    pan: stage('VERIFIED'), aadhaar: stage('VERIFIED'), liveness: stage('VERIFIED'), faceMatch: stage('VERIFIED'),
    bank: stage('VERIFIED', { accountNumber: '123456789012', ifscCode: 'HDFC0001234', accountName: 'Borrower One', bankName: 'HDFC Bank' }),
    credit: stage('REVIEW'),
  });

  const application = {
    personal: { name: 'Borrower One', email: 'borrower@example.com', mobile: '9876543210', address: 'Jaipur' },
    employment: { monthlyIncome: 40000 },
    documents: { incomeProofType: 'SALARY_SLIP' },
    bankDetails: { accountNumber: '123456789012', ifscCode: 'HDFC0001234', upiId: '' },
    amountRequested: 30000, tenureMonths: 6, purpose: 'Personal',
    consents: { creditReport: true, terms: true, privacy: true },
  };

  // 1. Double tap: same Idempotency-Key -> exactly one loan.
  const key = 'draft-key-0001';
  const [first, second] = await Promise.all([
    call('POST', '/api/loans', { body: application, headers: { 'Idempotency-Key': key } }),
    call('POST', '/api/loans', { body: application, headers: { 'Idempotency-Key': key } }),
  ]);
  const created = [first, second].filter((result) => result.status === 201 || result.status === 200);
  assert.ok(created.length >= 1, JSON.stringify([first.body, second.body]));
  for (const result of [first, second]) {
    assert.ok([200, 201, 409].includes(result.status), JSON.stringify(result.body));
    if (result.status === 409) assert.equal(result.body.code, 'APPLICATION_IN_PROGRESS');
  }
  const retry = await call('POST', '/api/loans', { body: application, headers: { 'Idempotency-Key': key } });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.data.repeated, true);
  assert.equal(await Loan.countDocuments({ userId: borrower._id }), 1);
  const loanId = retry.body.data.loanId;
  const loan = await Loan.findById(loanId).lean();
  assert.equal(loan.application.documents.aadhaarEkyc.verified, true);
  assert.equal(loan.application.documents.aadhaarEkyc.aadhaarData.photoBase64, undefined);

  // Documents are stored after the loan is saved, with a per-file status.
  const { storeLoanDocuments } = await import('../src/routes/loans.js');
  const realUpload = cloudinary.uploader.upload_stream;
  let failNext = false;
  cloudinary.uploader.upload_stream = (options, callback) => {
    if (failNext) {
      return new Writable({ write(_c, _e, done) { done(); }, final(done) { callback(new Error('cloudinary down')); done(); } });
    }
    return realUpload(options, callback);
  };
  const status = await storeLoanDocuments(loanId, [{ originalname: 'selfie.jpg', buffer: Buffer.from('img') }]);
  assert.equal(status.selfieUrl.status, 'UPLOADED');
  failNext = true;
  const failed = await storeLoanDocuments(loanId, [{ originalname: 'income_proof.pdf', buffer: Buffer.from('pdf') }], { uploadStatus: status });
  failNext = false;
  cloudinary.uploader.upload_stream = realUpload;
  assert.equal(failed.incomeProofUrl.status, 'FAILED');
  assert.equal(failed.incomeProofUrl.attempts, 3);
  const withDocs = (await Loan.findById(loanId).lean()).application.documents;
  assert.ok(withDocs.selfieUrl.startsWith(fakeUrl));
  assert.equal(withDocs.uploadStatus.selfieUrl.status, 'UPLOADED');
  assert.equal(withDocs.uploadStatus.incomeProofUrl.status, 'FAILED');
  assert.equal(withDocs.uploadReview.status, 'REVIEW');

  // 2. A different draft while a loan is active is refused.
  const other = await call('POST', '/api/loans', { body: application, headers: { 'Idempotency-Key': 'draft-key-0002' } });
  assert.equal(other.status, 409);
  assert.equal(other.body.code, 'ACTIVE_LOAN_EXISTS');

  // 3. Approval is blocked while credit is in REVIEW; no UPI is not a blocker.
  const offer = { decision: 'APPROVED', amountApproved: 30000, rateAPR: 0, tenureMonths: 6, processingFee: 0, taxAmount: 0 };
  const blocked = await call('POST', `/api/admin/loans/${loanId}/decision`, { user: admin, body: offer });
  assert.equal(blocked.status, 409);
  assert.deepEqual(blocked.body.data.stages, ['credit']);

  const badOffer = await call('POST', `/api/admin/loans/${loanId}/decision`, { user: admin, body: { ...offer, rateAPR: 'abc' } });
  assert.equal(badOffer.status, 400);

  const review = await call('POST', `/api/admin/loans/${loanId}/verification/credit/review`, { user: admin, body: { decision: 'VERIFIED', note: 'Thin file, income verified manually' } });
  assert.equal(review.status, 200, JSON.stringify(review.body));
  assert.equal(review.body.data.verificationPolicy.approvable, true);

  // 4. Approve at 0% APR: the EMI stays interest free.
  const approved = await call('POST', `/api/admin/loans/${loanId}/decision`, { user: admin, body: offer });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.data.decision.emi, 5000);
  assert.equal(approved.body.data.decision.totalRepaymentAmount, 30000);
  assert.equal(approved.body.data.agreement.status, 'PENDING_SIGNATURE');
  assert.match(approved.body.data.agreement.agreementSha256, /^[a-f0-9]{64}$/);

  const detail = await call('GET', `/api/admin/loans/${loanId}`, { user: admin });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.agreementDetails.status, 'PENDING_SIGNATURE');
  const list = await call('GET', '/api/admin/loans?status=APPROVED&limit=5', { user: admin });
  assert.equal(list.body.data.total, 1);
  assert.equal(list.body.data.items[0].signcareVerification.credit.status, 'VERIFIED');

  // 5. Disbursal before signing is refused.
  const early = await call('POST', `/api/admin/loans/${loanId}/disburse`, { user: admin, body: { txnId: 'UTR12345' } });
  assert.equal(early.status, 409);
  assert.equal(early.body.code, 'AGREEMENT_NOT_SIGNED');

  // 6. Start signing twice: one SignCare document, the link is reused.
  const start = await call('POST', `/api/loans/${loanId}/agreement/sign`, { body: { accepted: true } });
  assert.equal(start.status, 200, JSON.stringify(start.body));
  assert.equal(start.body.data.status, 'SIGNING');
  assert.equal(start.body.data.signingUrl, 'https://sign.example/1');
  const again = await call('POST', `/api/loans/${loanId}/agreement/sign`, { body: { accepted: true } });
  assert.equal(again.body.data.reused, true);
  assert.equal(calls.eSignRequest, 1);
  // The signed document is exactly the approved PDF.
  const approvedLoan = await Loan.findById(loanId).lean();
  const crypto = await import('node:crypto');
  assert.equal(crypto.createHash('sha256').update(signedPdf).digest('hex'), approvedLoan.agreement.agreementSha256);

  const pending = await call('POST', `/api/loans/${loanId}/agreement/status`);
  assert.equal(pending.body.data.status, 'SIGNING');

  // 7. Webhook without the token is rejected; with it, the loan becomes SIGNED.
  const unauth = await fetch(`${base}/api/signcare/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: 'DOC-1', documentStatus: 'Completed' }) });
  assert.equal(unauth.status, 401);
  signed = true;
  const hook = await fetch(`${base}/api/signcare/webhook?token=e2e-secret`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, data: { documentId: 'DOC-1', documentStatus: 'Completed' } }) });
  assert.equal(hook.status, 200);
  let signedLoan;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    signedLoan = await Loan.findById(loanId).lean();
    if (signedLoan.agreement?.status === 'SIGNED' && signedLoan.agreement?.auditTrailStatus === 'VERIFIED') break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.equal(signedLoan.agreement.status, 'SIGNED');
  assert.equal(signedLoan.decision.agreementStatus, 'SIGNED');
  assert.ok(signedLoan.agreement.signedAgreementUrl.startsWith(fakeUrl));
  assert.equal(signedLoan.statusHistory.filter((row) => row.status === 'AGREEMENT_SIGNED').length, 1);
  assert.equal(JSON.stringify(signedLoan).includes(signedPdf.toString('base64').slice(0, 200)), false);

  // Re-running the job or refresh does not sign twice.
  await syncPendingAgreements();
  const refresh = await call('POST', `/api/admin/loans/${loanId}/agreement/refresh`, { user: admin });
  assert.equal(refresh.body.data.status, 'SIGNED');
  assert.equal((await Loan.findById(loanId).lean()).statusHistory.filter((row) => row.status === 'AGREEMENT_SIGNED').length, 1);

  // 8. Double-click disbursal: exactly one succeeds and the schedule matches 0% APR.
  const [d1, d2] = await Promise.all([
    call('POST', `/api/admin/loans/${loanId}/disburse`, { user: admin, body: { txnId: 'UTR12345' } }),
    call('POST', `/api/admin/loans/${loanId}/disburse`, { user: admin, body: { txnId: 'UTR12345' } }),
  ]);
  assert.deepEqual([d1.status, d2.status].sort(), [200, 409]);
  const disbursed = await Loan.findById(loanId).lean();
  assert.equal(disbursed.status, 'DISBURSED');
  assert.equal(disbursed.transactions.length, 1);
  assert.equal(disbursed.schedule.length, 6);
  assert.equal(disbursed.schedule.reduce((sum, row) => sum + row.interest, 0), 0);
  assert.equal(Math.round(disbursed.schedule.reduce((sum, row) => sum + row.total, 0)), 30000);
});
