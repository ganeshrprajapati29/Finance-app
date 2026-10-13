// One source of truth for which verification stages a loan needs, used by
// application submit, the credit-report prerequisites and admin approval.
// Keeping them together stops the old deadlock where submit accepted a state
// (e.g. no UPI, or REVIEW) that approval could never accept.

export const LOAN_STAGE_LABELS = Object.freeze({
  pan: 'PAN',
  aadhaar: 'Aadhaar/DigiLocker',
  liveness: 'live selfie',
  faceMatch: 'face match',
  bank: 'bank account',
  upi: 'UPI ID',
  credit: 'credit report',
  bankStatement: 'bank statement analysis',
});

export const REVIEWABLE_STAGES = Object.freeze(Object.keys(LOAN_STAGE_LABELS));

const BASE_STAGES = ['pan', 'aadhaar', 'liveness', 'faceMatch', 'bank', 'credit'];

// Stages a provider outage may leave in REVIEW without blocking the customer.
// Identity stages (PAN, Aadhaar) have no outage fallback: they must be VERIFIED.
const SUBMIT_REVIEW_OK = new Set(['liveness', 'faceMatch', 'bank', 'upi', 'credit', 'bankStatement']);

// Credit bureau pulls are paid, so they only run once identity is settled.
export const CREDIT_PREREQUISITES = Object.freeze(['pan', 'aadhaar', 'liveness', 'faceMatch', 'bank']);
const CREDIT_REVIEW_OK = new Set(['liveness', 'faceMatch', 'bank']);

export const stageStatus = (verification, stage) =>
  String(verification?.[stage]?.status || 'NOT_STARTED').toUpperCase();

export const stageLabel = (stage) => LOAN_STAGE_LABELS[stage] || stage;

/**
 * @param {{ upiId?: string, incomeProofType?: string }} application
 * @returns {string[]} stages this application needs
 */
export function requiredLoanStages({ upiId = '', incomeProofType = '' } = {}) {
  const stages = [...BASE_STAGES];
  if (String(upiId || '').trim()) stages.push('upi');
  if (String(incomeProofType || '').toUpperCase() === 'BANK_STATEMENT') stages.push('bankStatement');
  return stages;
}

/** Application facts the policy reads, from a saved Loan document. */
export function loanPolicyInput(loan = {}) {
  const application = loan.application || {};
  return {
    upiId: application.bankDetails?.upiId || '',
    incomeProofType: application.documents?.incomeProofType || '',
  };
}

/**
 * Splits the required stages by status.
 * @returns {{ required: string[], verified: string[], review: string[], failed: string[], missing: string[] }}
 */
export function evaluateLoanVerification(verification, application = {}) {
  const required = requiredLoanStages(application);
  const result = { required, verified: [], review: [], failed: [], missing: [] };
  for (const stage of required) {
    const status = stageStatus(verification, stage);
    if (status === 'VERIFIED') result.verified.push(stage);
    else if (status === 'REVIEW') result.review.push(stage);
    else if (status === 'FAILED') result.failed.push(stage);
    else result.missing.push(stage);
  }
  return result;
}

/** Stages that stop the customer from submitting. REVIEW is allowed for outage-prone stages. */
export function submitBlockingStages(verification, application = {}) {
  const { required } = evaluateLoanVerification(verification, application);
  return required.filter((stage) => {
    const status = stageStatus(verification, stage);
    return !(status === 'VERIFIED' || (status === 'REVIEW' && SUBMIT_REVIEW_OK.has(stage)));
  });
}

/** Stages that stop approval. Everything must be VERIFIED; admins clear REVIEW manually. */
export function approvalBlockingStages(verification, application = {}) {
  const { required } = evaluateLoanVerification(verification, application);
  return required.filter((stage) => stageStatus(verification, stage) !== 'VERIFIED');
}

export function creditPrerequisiteGap(verification) {
  return CREDIT_PREREQUISITES.find((stage) => {
    const status = stageStatus(verification, stage);
    return !(status === 'VERIFIED' || (status === 'REVIEW' && CREDIT_REVIEW_OK.has(stage)));
  }) || null;
}

export const describeStages = (stages = []) => stages.map(stageLabel).join(', ');
