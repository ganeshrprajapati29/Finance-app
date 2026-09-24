import { friendlyVerificationMessage } from './friendlyProviderErrors.js';

function text(value) {
  return String(value ?? '').trim();
}

function positiveFlag(value) {
  const raw = text(value).toLowerCase();
  return value === true || value === 1 || ['1', 'true', 'yes', 'y', 'success', 'successful', 'verified', 'valid'].includes(raw);
}

function successText(value) {
  return /success|successful|verified|valid|completed|approved/i.test(text(value));
}

export function normalizeSigncarePennyDrop(data = {}, { accountNumber, ifsc } = {}) {
  const body = data && typeof data === 'object' ? data : {};
  const result = body.data && typeof body.data === 'object' ? body.data : body;
  const bankResponse = text(result.bankResponse || result.bank_response || result.response || body.message);
  const accountName = text(
    result.accountName || result.account_name || result.beneficiaryName ||
    result.beneficiary_name || result.name
  );
  const bankName = text(result.bankName || result.bank_name || result.bank || result.bank_name_en);
  const bankTxnStatus = positiveFlag(
    result.bankTxnStatus ?? result.bank_txn_status ?? result.bankStatus ??
    result.bank_status ?? result.status
  ) || successText(bankResponse);
  const success = positiveFlag(body.success) || successText(body.message) || Number(body.statusCode) === 100 || Number(body.statusCode) === 101 || bankTxnStatus;
  const failedByMessage = /invalid|failed|failure|not\s*found|unable|mismatch|inactive/i.test(bankResponse);
  const hasAccountSignal = Boolean(accountName) || bankTxnStatus;
  const isValid = success && hasAccountSignal && !failedByMessage;

  return {
    accountNumber: text(result.accountNumber || result.account_number || accountNumber),
    ifscCode: text(result.ifsc || result.ifscCode || result.ifsc_code || ifsc).toUpperCase(),
    accountName,
    beneficiaryName: accountName,
    bankName,
    bankResponse,
    bankTxnStatus,
    statusCode: body.statusCode ?? null,
    requestId: text(body.request_id || body.requestId),
    isValid,
    status: isValid ? 'VERIFIED' : 'FAILED',
    message: isValid
      ? (accountName ? `Bank account validated for ${accountName}.` : 'Bank account validated.')
      : friendlyVerificationMessage(bankResponse || body.message, {
          service: 'bank',
          fallback: 'Bank account could not be verified. Please check the account number and IFSC.',
        }),
    signcare: data,
  };
}
