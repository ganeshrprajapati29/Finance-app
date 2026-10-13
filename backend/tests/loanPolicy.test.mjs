import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// signcare.js reads its base URL at import time, so point it at a local fake
// before anything imports it. No test here may reach the real (billed) API.
const hits = [];
const fake = http.createServer((req, res) => {
  hits.push(req.url);
  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, message: 'Service Unavailable' }));
});
await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve));
process.env.SIGNCARE_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
process.env.SIGNCARE_API_KEY = 'test-key';
process.env.SIGNCARE_APP_ID = 'test-app';
process.env.SIGNCARE_WEBHOOK_SECRET = 'hook-secret-123';

const {
  approvalBlockingStages, creditPrerequisiteGap, requiredLoanStages, submitBlockingStages,
} = await import('../src/utils/loanVerificationPolicy.js');
const { addMonthsClamped, allInclusiveApr, buildRepaymentSchedule } = await import('../src/utils/loanSchedule.js');
const { agreementSha256, agreementTerms, generateLoanAgreementPdf } = await import('../src/services/loanAgreement.js');
const signcare = await import('../src/services/signcare.js');
const { webhookTokenValid, classifyWebhook, unwrap } = await import('../src/routes/signcareWebhook.js');
const {
  buildESignPayload, signerIdentity, hydrateAgreement, readStatus, signingStartDetails, eSignStartFailure,
} = await import('../src/services/loanAgreementSigning.js');
const signcareConfig = (await import('../src/config/signcare.js')).default;
const { privatePdfDeliveryUrl } = await import('../src/services/cloudinary.js');

test.after(() => fake.close());

const verified = (stages) => Object.fromEntries(stages.map((stage) => [stage, { status: 'VERIFIED' }]));
const BASE = ['pan', 'aadhaar', 'liveness', 'faceMatch', 'bank', 'credit'];

test('UPI and bank statement are required only when the application uses them', () => {
  assert.deepEqual(requiredLoanStages({}), BASE);
  assert.deepEqual(requiredLoanStages({ upiId: 'a@ybl' }), [...BASE, 'upi']);
  assert.deepEqual(requiredLoanStages({ incomeProofType: 'BANK_STATEMENT' }), [...BASE, 'bankStatement']);
});

test('a loan without UPI is approvable once the base stages are verified (old deadlock)', () => {
  assert.deepEqual(approvalBlockingStages(verified(BASE), { upiId: '' }), []);
  assert.deepEqual(approvalBlockingStages(verified(BASE), { upiId: 'a@ybl' }), ['upi']);
});

test('REVIEW lets the customer submit but blocks approval until an admin clears it', () => {
  const verification = { ...verified(BASE), bank: { status: 'REVIEW' }, credit: { status: 'REVIEW' } };
  assert.deepEqual(submitBlockingStages(verification, {}), []);
  assert.deepEqual(approvalBlockingStages(verification, {}), ['bank', 'credit']);
});

test('identity stages have no REVIEW shortcut at submit', () => {
  const verification = { ...verified(BASE), aadhaar: { status: 'REVIEW' }, pan: { status: 'FAILED' } };
  assert.deepEqual(submitBlockingStages(verification, {}), ['pan', 'aadhaar']);
  assert.deepEqual(submitBlockingStages({}, {}), BASE);
});

test('credit report prerequisites allow REVIEW only for outage-prone stages', () => {
  assert.equal(creditPrerequisiteGap({ ...verified(BASE), faceMatch: { status: 'REVIEW' } }), null);
  assert.equal(creditPrerequisiteGap({ ...verified(BASE), aadhaar: { status: 'PENDING' } }), 'aadhaar');
});

test('EMI schedule is reducing-balance, clears to zero and matches the standard formula', () => {
  const { emi, schedule, totalRepayment, totalInterest } = buildRepaymentSchedule({
    principal: 50000, annualRatePercent: 18, months: 12, startDate: new Date('2026-01-31T10:00:00'),
  });
  assert.equal(emi, 4584);
  assert.equal(schedule.length, 12);
  assert.equal(schedule.at(-1).closingBalance, 0);
  const principalSum = Math.round(schedule.reduce((sum, row) => sum + row.principal, 0) * 100) / 100;
  assert.equal(principalSum, 50000);
  assert.equal(Math.round((principalSum + totalInterest) * 100) / 100, totalRepayment);
  assert.equal(schedule[0].dueDate.getDate(), 28); // Jan 31 -> Feb 28
  assert.equal(schedule[1].dueDate.getDate(), 31); // back to the 31st in March
});

test('0% APR stays interest free', () => {
  const { emi, totalInterest, schedule } = buildRepaymentSchedule({ principal: 10000, annualRatePercent: 0, months: 3 });
  assert.equal(totalInterest, 0);
  assert.equal(emi, 3333.33);
  assert.equal(schedule.at(-1).total, 3333.34);
  assert.equal(allInclusiveApr({ principal: 10000, annualRatePercent: 0, months: 3 }), 0);
});

test('month arithmetic clamps leap-year February', () => {
  assert.equal(addMonthsClamped(new Date('2028-01-31T00:00:00'), 1).getDate(), 29);
});

test('all-inclusive APR is higher than the rate when fees are deducted', () => {
  const apr = allInclusiveApr({ principal: 50000, annualRatePercent: 18, months: 12, upfrontCharges: 1180 });
  assert.ok(apr > 18 && apr < 30, `apr ${apr}`);
});

test('agreement PDF carries the KFS terms and a stable fingerprint', async () => {
  const loan = {
    _id: '507f1f77bcf86cd799439011', userId: '507f1f77bcf86cd799439012', loanAccountNumber: '12345678',
    decision: { amountApproved: 50000, rateAPR: 18, tenureMonths: 12, processingFee: 1000, taxAmount: 180, decidedAt: new Date('2026-01-10') },
    application: { personal: { name: 'Test User', address: 'Jaipur' }, bankDetails: { accountNumber: '1234567890', ifscCode: 'HDFC0001234' } },
  };
  const pdf = await generateLoanAgreementPdf(loan, { name: 'Test User', email: 'test@example.com', mobile: '9999999999' });
  const pages = (pdf.toString('latin1').match(/\/Type \/Page[^s]/g) || []).length;
  assert.ok(pages >= 2 && pages <= 3, `pages ${pages}`);
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  const terms = agreementTerms(loan);
  assert.equal(terms.emi, 4584);
  assert.equal(terms.netDisbursal, 48820);
  assert.match(agreementSha256(pdf), /^[a-f0-9]{64}$/);
});

test('eSign payload follows the SignCare ExternalSignatureRequest schema', () => {
  const loan = { _id: '507f1f77bcf86cd799439011', userId: '507f1f77bcf86cd799439012', loanAccountNumber: '12345678' };
  const signer = signerIdentity({ borrower: { name: 'Rámesh K. <Singh>', email: 'R@Example.com', mobile: '+91 98765 43210' } });
  assert.deepEqual(signer, { name: 'R mesh K. Singh', emailId: 'r@example.com', mobileNo: '9876543210' });
  const payload = buildESignPayload({ loan, signer, pdf: Buffer.from('%PDF'), attempt: 2 });
  assert.equal(payload.referenceId, 'KP-LOAN-507f1f77bcf86cd799439011-2');
  assert.ok(payload.referenceId.length <= 64);
  assert.match(payload.referenceId, /^[A-Za-z0-9_-]+$/);
  assert.equal(payload.userInfo[0].userType, 'Signer');
  assert.equal(payload.userInfo[0].signatureType, 'Aadhaar');
  assert.equal(payload.userInfo[0].pageToBeSigned, 2);
  assert.equal(payload.userInfo[0].signAppearance, 4);
  assert.match(payload.documentInfo.name, /^[A-Za-z0-9 ,@_.'()[\]-]+$/);
});

test('signing needs a valid email, as SignCare requires emailId', () => {
  assert.throws(() => signerIdentity({ borrower: { name: 'Test User', email: '' } }), (error) => error.code === 'EMAIL_REQUIRED');
  assert.throws(() => signerIdentity({ borrower: { name: 'Test User', email: 'no-dot@example' } }), (error) => error.code === 'EMAIL_REQUIRED');
});

test('legacy decision fields hydrate into loan.agreement', () => {
  const loan = { decision: { agreementStatus: 'PENDING_SIGNATURE', agreementDocumentId: 'DOC1', agreementUrl: 'https://x/a.pdf' } };
  assert.equal(hydrateAgreement(loan).status, 'SIGNING');
  const signed = { decision: { agreementStatus: 'SIGNED', signedAgreementUrl: 'https://x/s.pdf' } };
  assert.equal(hydrateAgreement(signed).status, 'SIGNED');
});

test('eSign start and completion accept documented provider response variants', () => {
  assert.deepEqual(signingStartDetails({
    document_id: 'DOC-123', document_reference_id: 'REF-123',
    signerInfo: [{ eSignLink: 'https://sign.example/continue' }],
  }), {
    documentId: 'DOC-123', documentReferenceId: 'REF-123', signingUrl: 'https://sign.example/continue',
  });

  const status = readStatus({
    documentStatus: 'COMPLETED',
    signerInfo: [{ signerStatus: 'SIGNED' }],
    signedDocumentUrl: 'https://provider.example/signed.pdf',
  });
  assert.equal(status.completed, true);
  assert.equal(status.signedDocumentUrl, 'https://provider.example/signed.pdf');
});

test('eSign wallet exhaustion returns an actionable customer-safe error', () => {
  const error = eSignStartFailure({
    status: 422,
    providerMessage: 'Insufficient wallet balance for the requested eSign type. Please top up your SignCare wallet and retry.',
  });
  assert.equal(error.code, 'ESIGN_SERVICE_UNAVAILABLE');
  assert.equal(error.status, 503);
  assert.equal(error.message, 'Digital agreement signing is temporarily unavailable. Please contact KhatuPay support.');
});

test('Cloudinary agreement delivery uses a signed raw-PDF URL', () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  const url = privatePdfDeliveryUrl(
    'https://res.cloudinary.com/test-cloud/raw/upload/v123/khatupay/loan-agreements/agreement.pdf',
    2_000_000_000,
  );
  assert.match(url, /\/raw\/download\?/);
  assert.match(url, /expires_at=2000000000/);
});

test('paid SignCare calls are never retried; status reads retry once', async () => {
  hits.length = 0;
  await assert.rejects(signcare.fetchExperianReport({ pan: 'ABCDE1234F' }, 'KP-T1'));
  assert.equal(hits.filter((url) => url.includes('CreditBureau')).length, 1);

  hits.length = 0;
  await assert.rejects(signcare.createESign({ documentInfo: {} }, 'KP-T2'));
  assert.equal(hits.length, 1);

  hits.length = 0;
  await assert.rejects(signcare.verifyFaceMatch({ selfie: 'a', identityPhoto: 'b', requestId: 'KP-T3' }));
  assert.equal(hits.length, 1);

  hits.length = 0;
  await assert.rejects(signcare.getESignStatus({ documentId: 'D1' }, 'KP-T4'));
  assert.equal(hits.length, 2);
});

test('SignCare logs mask identity numbers and drop document payloads', () => {
  const logged = signcare.loggableSigncarePayload({
    pan_number: 'ABCDE1234F', mobileNumber: '9876543210', fileBase64: 'x'.repeat(500),
    data: { aadhaarNumber: '123412341234', name_as_per_pan_match: true },
  });
  assert.equal(logged.pan_number, '******234F');
  assert.equal(logged.mobileNumber, '******3210');
  assert.equal(logged.fileBase64, 'base64:500');
  assert.equal(logged.data.aadhaarNumber, '********1234');
  assert.equal(logged.data.name_as_per_pan_match, true);
});

test('webhook requires the shared token and SignCare is given a tokenised URL', () => {
  const request = (token, header) => ({ query: token ? { token } : {}, get: (name) => (name === 'x-webhook-token' ? header : undefined) });
  assert.equal(webhookTokenValid(request()), false);
  assert.equal(webhookTokenValid(request('wrong')), false);
  assert.equal(webhookTokenValid(request('hook-secret-123')), true);
  assert.equal(webhookTokenValid(request(undefined, 'hook-secret-123')), true);
  assert.match(signcareConfig.webhookUrl, /\?token=hook-secret-123$/);
  assert.equal(signcare.buildDigiLockerInitPayload({}).webhookUrl, signcareConfig.webhookUrl);
});

test('webhook payloads are routed by shape', () => {
  assert.equal(classifyWebhook({ transactionId: 'T', docs: [] }), 'digilocker');
  assert.equal(classifyWebhook({ documentId: 'D', documentStatus: 'Completed' }), 'eSign');
  assert.equal(classifyWebhook({ documentId: 'D', documentStatus: 'Signed', signerInfo: [] }), 'eSign');
  assert.equal(classifyWebhook({ verificationPassed: true, txnId: 'X' }), 'aadhaarOvse');
});

test('SignCare PascalCase eSign callbacks are normalized before reconciliation', () => {
  const event = unwrap({ DocumentId: 'DOC-1', DocumentReferenceId: 'REF-1', DocumentStatus: 'Signed', SignerInfo: [] });
  assert.equal(event.documentId, 'DOC-1');
  assert.equal(event.documentReferenceId, 'REF-1');
  assert.equal(event.documentStatus, 'Signed');
  assert.equal(classifyWebhook(event), 'eSign');
});
