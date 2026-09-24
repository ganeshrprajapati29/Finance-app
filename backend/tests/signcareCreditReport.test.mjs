import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExperianRetailRequest,
  decodeExperianExcel,
  detachExcelReport,
  experianRetailVerified,
  normalizeSigncareExperianRetail,
  reusableCreditStage,
  scoreBand,
  toIsoDate,
} from '../src/utils/signcareCreditReport.js';

const NOW = new Date(Date.UTC(2026, 8, 24));

// Mirrors the SignCare trial-center response: success:true with a contradictory
// message, an all-zero placeholder enquiry row and a base64 workbook.
const providerResponse = () => ({
  success: true,
  statusCode: 200,
  message: 'The verification request could not be completed (error 200).',
  request_id: 'e8d3fb57-f812-4360-9a24-8cdcab3add55',
  messages: [],
  data: {
    jsonExperianReport: {
      creditProfileHeader: { reportDate: '20260924', reportNumber: '1234567' },
      match_result: { exact_match: 'Y' },
      score: { fcirexScore: 628, fcirexScoreConfidLevel: '' },
      totalCAPS_Summary: {
        totalCAPSLast7Days: 0, totalCAPSLast30Days: 2, totalCAPSLast90Days: 3, totalCAPSLast180Days: 4,
      },
      caiS_Account: {
        caiS_Account_DETAILS: [
          {
            subscriber_Name: 'HDFC BANK', account_Number: 'XXXX1234', open_Date: 20190315,
            current_Balance: 45000, amount_Past_Due: 0, accountStatusDescription: 'Active',
            caiS_Account_History: [
              { year: 2026, month: 8, days_Past_Due: 0 },
              { year: 2026, month: 5, days_Past_Due: 45 },
            ],
            caiS_Holder_Details: [{ first_Name_Non_Normalized: 'GANESH', surname_Non_Normalized: 'PRAJAPATI' }],
          },
          {
            subscriber_Name: 'ICICI BANK', account_Number: 'XXXX9999', open_Date: 20210101,
            current_Balance: 0, amount_Past_Due: 0, accountStatusDescription: 'Closed',
            writtenOffSettledStatusDescription: 'Not Written Off',
            suitfiledwillfuldefaultwrittenoffstatusDescription: 'No Suit Filed',
          },
          {
            subscriber_Name: 'BAJAJ FINANCE', open_Date: 20220601, current_Balance: 12000, amount_Past_Due: 3000,
            accountStatusDescription: 'Active', writtenOffSettledStatusDescription: 'Settled',
            caiS_Account_History: [{ year: 2026, month: 9, days_Past_Due: 92 }],
          },
        ],
      },
    },
    excelExperianReport: 'UEsDBAoAAAAIAN0xOF3Itq9F',
  },
});

test('normalizer maps the provider report into an admin/underwriting summary', () => {
  const normalized = normalizeSigncareExperianRetail(providerResponse(), { requestId: 'KP-1' }, NOW);
  const { summary } = normalized;

  assert.equal(summary.score, 628);
  assert.equal(summary.scoreBand, 'Low');
  assert.equal(summary.reportNumber, '1234567');
  assert.equal(summary.exactMatch, 'Y');
  assert.equal(summary.bureauName, 'GANESH PRAJAPATI');
  assert.equal(summary.accountCount, 3);
  assert.equal(summary.closedAccounts, 1);
  assert.equal(summary.activeAccounts, 2);
  assert.equal(summary.outstandingBalance, 57000);
  assert.equal(summary.overdueAmount, 3000);
  assert.equal(summary.delinquentAccounts, 1);
  assert.equal(summary.writtenOffAccounts, 1, 'only the Settled tradeline counts, not "Not Written Off"/"No Suit Filed"');
  assert.equal(summary.maxDaysPastDue12m, 92);
  assert.equal(summary.creditAgeMonths, 90); // Mar 2019 -> Sep 2026
  assert.equal(summary.inquiries30Days, 2);
  assert.deepEqual(summary.inquiries, { last7Days: 0, last30Days: 2, last90Days: 3, last180Days: 4 });
  assert.equal(summary.hasExcelReport, true);
  assert.equal(normalized.experianReport, undefined, 'the duplicate alias is no longer stored');
  assert.ok(experianRetailVerified(normalized));
});

test('a contradictory provider message does not stop a report with a score from verifying', () => {
  const normalized = normalizeSigncareExperianRetail(providerResponse(), {}, NOW);
  assert.match(normalized.summary.message, /could not be completed/);
  assert.equal(experianRetailVerified(normalized), true);
});

test('an empty bureau skeleton is a review case, not a verified report', () => {
  const skeleton = normalizeSigncareExperianRetail(
    { success: true, statusCode: 200, data: { jsonExperianReport: { header: { systemCode: '0' }, userMessage: {} } } },
    {},
    NOW,
  );
  assert.equal(skeleton.summary.score, null);
  assert.equal(experianRetailVerified(skeleton), false);

  const missing = normalizeSigncareExperianRetail({ success: true, data: {} }, {}, NOW);
  assert.equal(experianRetailVerified(missing), false);
});

test('a report with a number but no tradelines (new-to-credit) still verifies', () => {
  const thinFile = normalizeSigncareExperianRetail(
    { success: true, data: { jsonExperianReport: { creditProfileHeader: { reportNumber: '77' } } } },
    {},
    NOW,
  );
  assert.equal(thinFile.summary.accountCount, 0);
  assert.equal(experianRetailVerified(thinFile), true);
});

test('out-of-range bureau scores are treated as no score', () => {
  const noHit = normalizeSigncareExperianRetail(
    { data: { jsonExperianReport: { creditProfileHeader: { reportNumber: '1' }, score: { fcirexScore: 0 } } } },
    {},
    NOW,
  );
  assert.equal(noHit.summary.score, null);
  assert.equal(scoreBand(null), '');
  assert.equal(scoreBand(780), 'Excellent');
  assert.equal(scoreBand(720), 'Good');
  assert.equal(scoreBand(660), 'Fair');
});

test('detachExcelReport keeps the workbook out of the stored loan record', () => {
  const normalized = normalizeSigncareExperianRetail(providerResponse(), {}, NOW);
  const { lean, excel } = detachExcelReport(normalized);
  assert.equal(excel, 'UEsDBAoAAAAIAN0xOF3Itq9F');
  assert.equal('excelExperianReport' in lean, false);
  assert.equal(lean.summary.hasExcelReport, true);
});

test('decodeExperianExcel only accepts real zip workbooks', () => {
  const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('payload')]).toString('base64');
  assert.ok(decodeExperianExcel(zip));
  assert.ok(decodeExperianExcel(`data:application/octet-stream;base64,${zip}`));
  assert.equal(decodeExperianExcel(Buffer.from('not a workbook').toString('base64')), null);
  assert.equal(decodeExperianExcel(''), null);
});

test('toIsoDate understands the shapes KYC providers return', () => {
  assert.equal(toIsoDate('13-09-2003'), '2003-09-13');
  assert.equal(toIsoDate('13/09/2003'), '2003-09-13');
  assert.equal(toIsoDate('2003-09-13'), '2003-09-13');
  assert.equal(toIsoDate('20030913'), '2003-09-13');
  assert.equal(toIsoDate('13092003'), '2003-09-13');
  assert.equal(toIsoDate('31-02-2003'), '');
  assert.equal(toIsoDate('2003'), '');
  assert.equal(toIsoDate(''), '');
});

const kycUser = (overrides = {}) => ({
  mobile: '+91 91407 18388',
  name: 'Ganesh Prajapati',
  kyc: {
    panNumber: 'eoqpp8094r',
    panName: 'GANESH RAMESH PRAJAPATI',
    aadhaarData: { dob: '13-09-2003', pincode: '273407' },
  },
  ...overrides,
});

test('request builder resolves every field from saved KYC', () => {
  const { request, missing } = buildExperianRetailRequest({ user: kycUser(), verification: {} });
  assert.deepEqual(missing, []);
  assert.deepEqual(request, {
    phoneNumber: 9140718388,
    pan: 'EOQPP8094R',
    firstName: 'GANESH',
    lastName: 'PRAJAPATI',
    dateOfBirth: '2003-09-13',
    pincode: 273407,
  });
});

test('request builder prefers the verification record and finds a pincode inside the address text', () => {
  const { request, missing } = buildExperianRetailRequest({
    user: kycUser({ kyc: { panNumber: 'EOQPP8094R', panName: 'Ganesh Prajapati' } }),
    verification: {
      pan: { data: { firstName: 'Ganesh', lastName: 'Prajapati' } },
      aadhaar: { data: { dob: '13/09/2003', address: 'Ward 4, Kushinagar, Uttar Pradesh 273407' } },
    },
  });
  assert.deepEqual(missing, []);
  assert.equal(request.dateOfBirth, '2003-09-13');
  assert.equal(request.pincode, 273407);
  assert.equal(request.firstName, 'Ganesh');
});

test('request builder reports what is missing instead of guessing', () => {
  const { missing, missingLabels } = buildExperianRetailRequest({
    user: { mobile: '12345', kyc: { panNumber: 'BAD' } },
    verification: {},
  });
  assert.deepEqual(missing, ['phoneNumber', 'pan', 'firstName', 'dateOfBirth', 'pincode']);
  assert.ok(missingLabels.includes('PIN code'));
});

test('a stored report is reused only for the same identity and inside its window', () => {
  const { request } = buildExperianRetailRequest({ user: kycUser(), verification: {} });
  const fetchedAt = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000);
  const stage = {
    status: 'VERIFIED',
    verifiedAt: fetchedAt,
    data: { request, summary: { hasJsonReport: true } },
  };

  assert.equal(reusableCreditStage(stage, request, NOW.getTime()), true);
  assert.equal(reusableCreditStage(stage, { ...request, pincode: 110001 }, NOW.getTime()), false);
  assert.equal(reusableCreditStage(stage, request, NOW.getTime() + 40 * 24 * 60 * 60 * 1000), false);
  assert.equal(reusableCreditStage({ ...stage, status: 'FAILED' }, request, NOW.getTime()), false);
  assert.equal(
    reusableCreditStage({ ...stage, data: { request, summary: { hasJsonReport: false } } }, request, NOW.getTime()),
    false,
  );

  const review = { status: 'REVIEW', updatedAt: new Date(NOW.getTime() - 60 * 60 * 1000), data: { request } };
  assert.equal(reusableCreditStage(review, request, NOW.getTime()), true);
  assert.equal(reusableCreditStage(review, request, NOW.getTime() + 48 * 60 * 60 * 1000), false);
});

test('workbook is stripped from stored reports but its existence is kept', async () => {
  const { withoutWorkbook, verificationWithoutWorkbook } = await import('../src/utils/signcareCreditReport.js');

  const stripped = withoutWorkbook({ excelExperianReport: 'UEsD', summary: { score: 700 }, jsonExperianReport: { a: 1 } });
  assert.equal('excelExperianReport' in stripped, false);
  assert.equal(stripped.summary.hasExcelReport, true);
  assert.equal(stripped.summary.score, 700);

  assert.equal(withoutWorkbook({ excelExperianReport: '' }).summary.hasExcelReport, false);
  const clean = { summary: { score: 1 } };
  assert.equal(withoutWorkbook(clean), clean, 'untouched when there is nothing to strip');
  assert.equal(withoutWorkbook(null), null);

  const row = { userId: 'u', credit: { status: 'VERIFIED', data: { excelExperianReport: 'UEsD' } } };
  const light = verificationWithoutWorkbook(row);
  assert.equal('excelExperianReport' in light.credit.data, false);
  assert.equal(light.credit.status, 'VERIFIED');
  assert.equal('excelExperianReport' in row.credit.data, true, 'input is not mutated');
  assert.equal(verificationWithoutWorkbook(null), null);
});
