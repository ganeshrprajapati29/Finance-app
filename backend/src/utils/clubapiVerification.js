const SUCCESS_STATUSES = new Set(['SUCCESS', 'VERIFIED', 'VALID', 'COMPLETED', 'APPROVED']);
const FAILURE_STATUSES = new Set(['FAILED', 'FAILURE', 'ERROR', 'INVALID', 'REJECTED']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function upperStatus(...values) {
  return firstText(...values).toUpperCase();
}

function responseParts(data = {}) {
  const root = asObject(data);
  const nested = asObject(root.data);
  const upiData = asObject(root.upiData);
  return { root, nested, upiData };
}

function providerMessage(root, nested, fallback) {
  return firstText(
    root.resText,
    root.message,
    root.error,
    root.statusMessage,
    nested.resText,
    nested.message,
    nested.error,
    fallback
  );
}

function failedByText(message) {
  return /invalid|failed|failure|not\s*found|unable|error|mismatch|inactive/i.test(message);
}

export function normalizeClubapiBankValidation(data = {}, { accountNumber, ifscCode } = {}) {
  const { root, nested } = responseParts(data);
  const status = upperStatus(root.status, root.verificationStatus, nested.status, nested.verificationStatus);
  const accountName = firstText(
    root.beneficiaryName,
    root.accountName,
    root.name,
    root.accountHolderName,
    nested.beneficiaryName,
    nested.accountName,
    nested.name,
    nested.accountHolderName
  );
  const resText = providerMessage(root, nested, '');
  const explicitValid = [root.isValid, root.valid, root.verified, nested.isValid, nested.valid, nested.verified]
    .some((value) => value === true || String(value).toLowerCase() === 'true');
  const explicitInvalid = [root.isValid, root.valid, root.verified, nested.isValid, nested.valid, nested.verified]
    .some((value) => value === false || String(value).toLowerCase() === 'false');
  const hasSuccess = SUCCESS_STATUSES.has(status) || explicitValid;
  const hasFailure = FAILURE_STATUSES.has(status) || explicitInvalid || failedByText(resText);
  const isValid = !hasFailure && (hasSuccess || Boolean(accountName));

  return {
    accountNumber: String(accountNumber || root.accountNumber || nested.accountNumber || '').trim(),
    ifscCode: String(ifscCode || root.ifscCode || root.ifsc || nested.ifscCode || nested.ifsc || '').toUpperCase(),
    operatorId: String(root.operatorId || nested.operatorId || '233'),
    isValid,
    accountName,
    beneficiaryName: accountName,
    status: status || (isValid ? 'VERIFIED' : 'FAILED'),
    resText,
    message: isValid ? (accountName ? `Bank account validated for ${accountName}.` : 'Bank account validated.') : (resText || 'Bank account could not be verified.'),
    clubapi: data,
  };
}

export function normalizeClubapiUpiValidation(data = {}, { upiId } = {}) {
  const { root, nested, upiData } = responseParts(data);
  const status = upperStatus(root.status, root.verificationStatus, nested.status, nested.verificationStatus, upiData.status);
  const accountName = firstText(
    root.name,
    root.accountName,
    root.upiName,
    root.beneName,
    root.beneficiaryName,
    nested.name,
    nested.accountName,
    nested.upiName,
    nested.beneName,
    nested.beneficiaryName,
    upiData.name,
    upiData.accountName
  );
  const resText = providerMessage(root, nested, '');
  const explicitValid = [root.isValid, root.valid, root.verified, nested.isValid, nested.valid, nested.verified, upiData.isValid]
    .some((value) => value === true || String(value).toLowerCase() === 'true');
  const explicitInvalid = [root.isValid, root.valid, root.verified, nested.isValid, nested.valid, nested.verified, upiData.isValid]
    .some((value) => value === false || String(value).toLowerCase() === 'false');
  const hasSuccess = SUCCESS_STATUSES.has(status) || explicitValid;
  const hasFailure = FAILURE_STATUSES.has(status) || explicitInvalid || failedByText(resText);
  const isValid = !hasFailure && (hasSuccess || Boolean(accountName));

  return {
    upiId: String(upiId || root.upiId || nested.upiId || '').trim().toLowerCase(),
    isValid,
    accountName,
    beneficiaryName: accountName,
    status: status || (isValid ? 'VERIFIED' : 'FAILED'),
    resText,
    message: isValid ? (accountName ? `UPI ID validated for ${accountName}.` : 'UPI ID validated.') : (resText || 'UPI ID could not be verified.'),
    clubapi: data,
  };
}
