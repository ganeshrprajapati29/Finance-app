import axios from 'axios';
import http from 'http';
import https from 'https';

export class OtpDeliveryError extends Error {
  constructor(message = 'We could not send a verification code right now.') {
    super(message);
    this.name = 'OtpDeliveryError';
  }
}

const ipv4HttpAgent = new http.Agent({ family: 4 });
const ipv4HttpsAgent = new https.Agent({ family: 4 });

function normalizedIndianMobile(value, callingCode) {
  let digits = String(value || '').replace(/\D/g, '');
  // Only remove India's country code when it is actually a 12-digit number.
  // A valid Indian mobile can itself start with "91" (for example 9140718388).
  if (digits.startsWith('0091')) digits = digits.slice(4);
  else if (digits.startsWith(callingCode) && digits.length === 12) {
    digits = digits.slice(callingCode.length);
  }
  if (!/^[6-9]\d{9}$/.test(digits)) {
    throw new OtpDeliveryError('Enter a valid 10-digit Indian mobile number.');
  }
  return digits;
}

/**
 * Sends an SMS through APITxT. Some accounts use the provider-managed
 * transactional route without merchant DLT fields; therefore sender/template
 * values are optional and only included when configured.
 */
export async function sendApitxtOtp({ mobile, otp, purpose = 'verification' }) {
  const authkey = String(process.env.APITXT_AUTH_KEY || '').trim();
  const baseUrl = String(process.env.APITXT_BASE_URL || '').trim().replace(/\/$/, '');
  // APITxT's standard OTP endpoint. An explicit endpoint is still supported
  // for an account-specific route, but it must not be required for normal SMS.
  const url = String(process.env.APITXT_OTP_SEND_URL || `${baseUrl}/api/sendOTP`).trim();
  const callingCode = String(process.env.APITXT_DEFAULT_COUNTRY || '91').replace(/\D/g, '');
  const sender = String(process.env.APITXT_OTP_SENDER_ID || '').trim();
  const templateId = String(process.env.APITXT_OTP_TEMPLATE_ID || '').trim();

  if (!authkey || !baseUrl || !url.startsWith('https://')) {
    throw new OtpDeliveryError(
      'SMS verification is being activated. Please use email verification for now.'
    );
  }

  const localMobile = normalizedIndianMobile(mobile, callingCode || '91');
  const recipient = `${callingCode || '91'}${localMobile}`;
  try {
    const form = new URLSearchParams({
      authkey,
      mobile: recipient,
      otp: String(otp),
      channel: 'sms',
    });
    if (sender) form.set('sender', sender);
    if (templateId) form.set('template_id', templateId);
    const response = await axios.post(url, form.toString(), {
      timeout: 15000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      httpAgent: ipv4HttpAgent,
      httpsAgent: ipv4HttpsAgent,
      validateStatus: () => true,
    });

    const data = response.data || {};
    if (response.status >= 400 || String(data.status || '').toLowerCase() !== 'success') {
      throw new Error(String(data.message || data.error || 'Provider rejected the request'));
    }
    return { provider: 'apitxt', requestId: data.request_id || data.requestId || data.id || null };
  } catch (error) {
    // Provider payloads can contain account/configuration details; never pass
    // those through an authentication API or application logs.
    console.error('APITxT OTP delivery failed:', error.response?.status || error.code || error.name);
    throw new OtpDeliveryError();
  }
}
