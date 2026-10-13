import 'dotenv/config';

const flag = (name, fallback) => {
  const value = String(process.env[name] ?? '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
};
const number = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};
const text = (name, fallback) => String(process.env[name] || '').trim() || fallback;

// Product rules for the loan journey. Everything a compliance or ops change
// might need to flip lives here instead of inside route handlers.
const loanPolicy = {
  minAmount: number('LOAN_MIN_AMOUNT', 1000),
  maxAmount: number('LOAN_MAX_AMOUNT', 500000),
  minTenureMonths: 3,
  maxTenureMonths: 60,
  maxAprPercent: number('LOAN_MAX_APR', 48),
  // KYC stages must be VERIFIED (or REVIEW after a provider outage) before an
  // application is accepted. Turn off only for an emergency.
  requireKycAtSubmit: flag('LOAN_REQUIRE_KYC_AT_SUBMIT', true),
  requireSelfieDocument: flag('LOAN_REQUIRE_SELFIE_DOCUMENT', false),
  requireIncomeProof: flag('LOAN_REQUIRE_INCOME_PROOF', false),
  agreement: {
    lenderName: text('LOAN_LENDER_NAME', 'Partner lender'),
    lspName: text('LOAN_LSP_NAME', 'KhatuPay'),
    coolingOffDays: number('LOAN_COOLING_OFF_DAYS', 3),
    penalChargesText: text(
      'LOAN_PENAL_CHARGES',
      'Late payment: 2% per month on the overdue instalment amount, charged only on the amount overdue. No penal interest is added to the interest rate.',
    ),
    grievanceName: text('LOAN_GRIEVANCE_OFFICER', 'Grievance Redressal Officer, KhatuPay'),
    grievanceEmail: text('LOAN_GRIEVANCE_EMAIL', 'support@khatupay.com'),
    grievancePhone: text('LOAN_GRIEVANCE_PHONE', ''),
  },
};

export default loanPolicy;
