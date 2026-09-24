import { isSevereAccount } from './signcareCreditReport.js';

function asNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stageStatus(verification, key) {
  return String(verification?.[key]?.status || 'NOT_STARTED').toUpperCase();
}

function creditData(verification = {}) {
  const data = verification?.credit?.data || {};
  return data.jsonExperianReport || data.experianReport || data;
}

function creditAccounts(report = {}) {
  return asArray(report?.caiS_Account?.caiS_Account_DETAILS);
}

function bankStatementReport(verification = {}) {
  const data = verification?.bankStatement?.data || {};
  return data.jsonDetails || data.json_details || data;
}

function amount(value) {
  if (value === null || value === undefined) return 0;
  return asNumber(String(value).replace(/[^\d.-]/g, ''), 0) || 0;
}

export function buildUnderwritingSummary({ loan = {}, verification = {} } = {}) {
  const application = loan.application || {};
  const requestedAmount = asNumber(application.amountRequested, 0) || 0;
  const monthlyIncome = asNumber(application.employment?.monthlyIncome, 0) || 0;
  const emiBurdenRatio = monthlyIncome > 0 && requestedAmount > 0
    ? Number((requestedAmount / Math.max(monthlyIncome * 12, 1)).toFixed(2))
    : null;

  const report = creditData(verification);
  const accounts = creditAccounts(report);
  const score = asNumber(report?.score?.fcirexScore ?? report?.score ?? verification?.credit?.summary?.score);
  const overdueAmount = accounts.reduce((sum, item) => sum + amount(item.amount_Past_Due), 0);
  const outstandingBalance = accounts.reduce((sum, item) => sum + amount(item.current_Balance), 0);
  const activeAccounts = accounts.filter((item) => !item.date_Closed && amount(item.current_Balance) > 0).length;
  const inquiries30Days = asNumber(report?.totalCAPS_Summary?.totalCAPSLast30Days, 0) || 0;
  // The bureau summary is computed once at fetch time; older records fall back to the raw tradelines.
  const bureauSummary = verification?.credit?.data?.summary || {};
  const writtenOffAccounts = asNumber(bureauSummary.writtenOffAccounts, null) ?? accounts.filter(isSevereAccount).length;
  const maxDaysPastDue = asNumber(bureauSummary.maxDaysPastDue12m, 0) || 0;

  const bsa = bankStatementReport(verification);
  const statementAccount = bsa?.statementAccount || {};
  const statementTransactions = asArray(bsa?.consolidatedinfo?.xns_list);

  const requiredStages = ['pan', 'aadhaar', 'liveness', 'faceMatch', 'bank', 'upi', 'credit'];
  const incompleteStages = requiredStages.filter((key) => stageStatus(verification, key) !== 'VERIFIED');
  if (application.documents?.incomeProofType === 'BANK_STATEMENT' && stageStatus(verification, 'bankStatement') !== 'VERIFIED') {
    incompleteStages.push('bankStatement');
  }

  const flags = [];
  let riskPoints = 0;

  if (score !== null) {
    if (score < 600) { riskPoints += 40; flags.push({ code: 'LOW_BUREAU_SCORE', severity: 'HIGH', message: 'Credit bureau score is below 600.' }); }
    else if (score < 700) { riskPoints += 20; flags.push({ code: 'MODERATE_BUREAU_SCORE', severity: 'MEDIUM', message: 'Credit bureau score is below 700.' }); }
  } else {
    riskPoints += 25;
    flags.push({ code: 'BUREAU_SCORE_MISSING', severity: 'MEDIUM', message: 'Credit bureau score is not available.' });
  }

  if (overdueAmount > 0) {
    riskPoints += overdueAmount >= 5000 ? 35 : 20;
    flags.push({ code: 'OVERDUE_CREDIT', severity: overdueAmount >= 5000 ? 'HIGH' : 'MEDIUM', message: `Credit report shows overdue amount of Rs. ${overdueAmount}.` });
  }

  if (writtenOffAccounts > 0) {
    riskPoints += 30;
    flags.push({ code: 'WRITTEN_OFF_OR_SETTLED', severity: 'HIGH', message: `Credit report shows ${writtenOffAccounts} written-off, settled or suit-filed account(s).` });
  }

  if (maxDaysPastDue >= 90) {
    riskPoints += 25;
    flags.push({ code: 'SEVERE_DELINQUENCY', severity: 'HIGH', message: `Credit report shows a payment ${maxDaysPastDue} days past due in the last 12 months.` });
  } else if (maxDaysPastDue >= 30) {
    riskPoints += 10;
    flags.push({ code: 'RECENT_DELINQUENCY', severity: 'MEDIUM', message: `Credit report shows a payment ${maxDaysPastDue} days past due in the last 12 months.` });
  }

  if (inquiries30Days >= 5) {
    riskPoints += 15;
    flags.push({ code: 'HIGH_RECENT_INQUIRIES', severity: 'MEDIUM', message: 'High number of recent credit enquiries.' });
  }

  if (monthlyIncome > 0 && requestedAmount > monthlyIncome * 10) {
    riskPoints += 20;
    flags.push({ code: 'HIGH_LOAN_TO_INCOME', severity: 'MEDIUM', message: 'Requested amount is high compared with declared monthly income.' });
  }

  if (incompleteStages.length) {
    riskPoints += Math.min(30, incompleteStages.length * 10);
    flags.push({ code: 'VERIFICATION_INCOMPLETE', severity: 'HIGH', message: `Incomplete verification stages: ${incompleteStages.join(', ')}.` });
  }

  if (application.documents?.incomeProofType === 'BANK_STATEMENT' && statementTransactions.length === 0) {
    riskPoints += 10;
    flags.push({ code: 'BSA_TRANSACTIONS_MISSING', severity: 'LOW', message: 'Bank statement analysis did not return transaction rows.' });
  }

  const scoreOutOf100 = Math.max(0, Math.min(100, 100 - riskPoints));
  const riskLevel = scoreOutOf100 >= 75 ? 'LOW' : scoreOutOf100 >= 50 ? 'MEDIUM' : 'HIGH';
  const recommendation = incompleteStages.length
    ? 'COMPLETE_VERIFICATION'
    : riskLevel === 'LOW'
      ? 'APPROVE'
      : riskLevel === 'MEDIUM'
        ? 'MANUAL_REVIEW'
        : 'REJECT_OR_REVIEW';

  return {
    provider: 'SIGNCARE_UNDERWRITING_SUMMARY',
    generatedAt: new Date(),
    score: scoreOutOf100,
    riskLevel,
    recommendation,
    flags,
    metrics: {
      requestedAmount,
      monthlyIncome,
      emiBurdenRatio,
      bureauScore: score,
      activeCreditAccounts: activeAccounts,
      outstandingBalance,
      overdueAmount,
      inquiries30Days,
      writtenOffAccounts,
      maxDaysPastDue12m: maxDaysPastDue,
      bankStatementTransactions: statementTransactions.length,
      statementBank: statementAccount.bank || '',
      incompleteStages,
    },
  };
}
