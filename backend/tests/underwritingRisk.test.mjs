import test from 'node:test';
import assert from 'node:assert/strict';

import { buildUnderwritingSummary } from '../src/utils/underwritingRisk.js';

const verifiedStages = {
  pan: { status: 'VERIFIED' },
  aadhaar: { status: 'VERIFIED' },
  liveness: { status: 'VERIFIED' },
  faceMatch: { status: 'VERIFIED' },
  bank: { status: 'VERIFIED' },
  upi: { status: 'VERIFIED' },
  credit: { status: 'VERIFIED' },
};

test('underwriting summary approves low-risk verified application', () => {
  const summary = buildUnderwritingSummary({
    loan: {
      application: {
        amountRequested: 50000,
        employment: { monthlyIncome: 40000 },
        documents: { incomeProofType: 'SALARY_SLIP' },
      },
    },
    verification: {
      ...verifiedStages,
      credit: {
        status: 'VERIFIED',
        summary: { score: 760 },
        data: {
          jsonExperianReport: {
            score: { fcirexScore: 760 },
            caiS_Account: {
              caiS_Account_DETAILS: [
                { current_Balance: '12000', amount_Past_Due: '0' },
              ],
            },
            totalCAPS_Summary: { totalCAPSLast30Days: 1 },
          },
        },
      },
    },
  });

  assert.equal(summary.riskLevel, 'LOW');
  assert.equal(summary.recommendation, 'APPROVE');
  assert.equal(summary.metrics.bureauScore, 760);
  assert.equal(summary.metrics.incompleteStages.length, 0);
});

test('underwriting summary flags high-risk incomplete application', () => {
  const summary = buildUnderwritingSummary({
    loan: {
      application: {
        amountRequested: 250000,
        employment: { monthlyIncome: 18000 },
        documents: { incomeProofType: 'BANK_STATEMENT' },
      },
    },
    verification: {
      pan: { status: 'VERIFIED' },
      aadhaar: { status: 'VERIFIED' },
      credit: {
        status: 'VERIFIED',
        data: {
          jsonExperianReport: {
            score: { fcirexScore: 580 },
            caiS_Account: {
              caiS_Account_DETAILS: [
                { current_Balance: '90000', amount_Past_Due: '7500' },
              ],
            },
            totalCAPS_Summary: { totalCAPSLast30Days: 6 },
          },
        },
      },
    },
  });

  assert.equal(summary.riskLevel, 'HIGH');
  assert.equal(summary.recommendation, 'COMPLETE_VERIFICATION');
  assert.ok(summary.flags.some((flag) => flag.code === 'LOW_BUREAU_SCORE'));
  assert.ok(summary.flags.some((flag) => flag.code === 'OVERDUE_CREDIT'));
  assert.ok(summary.flags.some((flag) => flag.code === 'VERIFICATION_INCOMPLETE'));
  assert.ok(summary.metrics.incompleteStages.includes('bankStatement'));
});

test('underwriting summary flags written-off accounts and deep recent delinquency', () => {
  const summary = buildUnderwritingSummary({
    loan: { application: { amountRequested: 20000, employment: { monthlyIncome: 40000 }, documents: { incomeProofType: 'SALARY_SLIP' } } },
    verification: {
      ...verifiedStages,
      credit: {
        status: 'VERIFIED',
        data: {
          summary: { writtenOffAccounts: 1, maxDaysPastDue12m: 120 },
          jsonExperianReport: { score: { fcirexScore: 720 }, caiS_Account: { caiS_Account_DETAILS: [] } },
        },
      },
    },
  });

  assert.ok(summary.flags.some((flag) => flag.code === 'WRITTEN_OFF_OR_SETTLED'));
  assert.ok(summary.flags.some((flag) => flag.code === 'SEVERE_DELINQUENCY'));
  assert.equal(summary.metrics.writtenOffAccounts, 1);
  assert.equal(summary.metrics.maxDaysPastDue12m, 120);
  assert.notEqual(summary.riskLevel, 'LOW');
});

test('underwriting falls back to raw tradelines when the bureau summary is absent (older records)', () => {
  const summary = buildUnderwritingSummary({
    loan: { application: { amountRequested: 20000, employment: { monthlyIncome: 40000 }, documents: { incomeProofType: 'SALARY_SLIP' } } },
    verification: {
      ...verifiedStages,
      credit: {
        status: 'VERIFIED',
        data: {
          jsonExperianReport: {
            score: { fcirexScore: 780 },
            caiS_Account: { caiS_Account_DETAILS: [{ current_Balance: 0, amount_Past_Due: 0, writtenOffSettledStatusDescription: 'Written-off' }] },
          },
        },
      },
    },
  });

  assert.ok(summary.flags.some((flag) => flag.code === 'WRITTEN_OFF_OR_SETTLED'));
  assert.equal(summary.metrics.maxDaysPastDue12m, 0);
});
