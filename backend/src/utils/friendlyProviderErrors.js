function text(value) {
  return String(value ?? '').trim();
}

export function friendlyVerificationMessage(message, { service = '', fallback = 'Verification could not be completed. Please try again.' } = {}) {
  const raw = text(message);
  const lower = raw.toLowerCase();
  const key = text(service).toLowerCase();

  if (!raw) return fallback;
  if (/timeout|timed\s*out|econnaborted|slow|max\s*retries/i.test(raw)) {
    return 'Verification is taking longer than usual. Please try again in a moment.';
  }
  if (/credential|unauthori[sz]ed|authentication|api\s*key|token|forbidden/i.test(raw)) {
    return 'Verification service is temporarily unavailable. Please try again later.';
  }
  if (/route\s+not\s+found|not\s+enabled|not\s+active|inactive/i.test(raw)) {
    return 'This verification service is not available right now. Please contact support.';
  }
  if (/invalid|failed|failure|not\s*found|unable|mismatch|reject|declin/i.test(raw)) {
    if (key.includes('liveness')) {
      return 'Live face verification failed. Please retake the selfie in good light with only your face visible.';
    }
    if (key.includes('face')) {
      return 'Face match failed. Please use a clear selfie and complete Aadhaar verification again if needed.';
    }
    if (key.includes('bank')) {
      return 'Bank account could not be verified. Please check the account number and IFSC.';
    }
    if (key.includes('upi')) {
      return 'UPI ID could not be verified. Please check the UPI ID and try again.';
    }
    if (key.includes('pan')) {
      return 'PAN could not be verified. Please check the PAN number and name.';
    }
    if (key.includes('aadhaar') || key.includes('digilocker')) {
      return 'Identity verification could not be completed. Please try Aadhaar/DigiLocker again.';
    }
    if (key.includes('credit') || key.includes('bureau') || key.includes('experian')) {
      return 'Credit report could not be fetched. Please check PAN, Aadhaar and profile details.';
    }
    return fallback;
  }

  return raw.length > 140 ? fallback : raw;
}
