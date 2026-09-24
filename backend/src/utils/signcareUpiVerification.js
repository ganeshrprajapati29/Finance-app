import { friendlyVerificationMessage } from './friendlyProviderErrors.js';

function text(value) {
  return String(value ?? '').trim();
}

export function normalizeSigncareUpiName(data = {}, { upiId } = {}) {
  const body = data && typeof data === 'object' ? data : {};
  const result = body.data && typeof body.data === 'object' ? body.data : body;
  const beneficiaryName = text(result.beneficiary_name || result.beneficiaryName || result.accountName || result.name);
  const success = body.success === true || String(body.success).toLowerCase() === 'true';
  const statusCode = Number(body.statusCode ?? body.status_code ?? 0);
  const message = text(body.message || result.message);
  const failedByMessage = /invalid|failed|failure|not\s*found|unable|mismatch|inactive/i.test(message);
  const isValid = success && Boolean(beneficiaryName) && !failedByMessage;

  return {
    upiId: text(upiId || result.upiId || result.customer_upi_id).toLowerCase(),
    isValid,
    accountName: beneficiaryName,
    beneficiaryName,
    beneficiary_name: beneficiaryName,
    statusCode: Number.isFinite(statusCode) && statusCode > 0 ? statusCode : null,
    requestId: text(body.request_id || body.requestId),
    status: isValid ? 'VERIFIED' : 'FAILED',
    message: isValid
      ? `UPI ID validated for ${beneficiaryName}.`
      : friendlyVerificationMessage(message, {
          service: 'upi',
          fallback: 'UPI ID could not be verified. Please check the UPI ID and try again.',
        }),
    signcare: data,
  };
}
