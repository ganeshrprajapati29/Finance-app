import axios from 'axios';
import crypto from 'crypto';
import signcareConfig from '../config/signcare.js';
import { friendlyVerificationMessage } from '../utils/friendlyProviderErrors.js';

const client = axios.create({ baseURL: signcareConfig.baseURL, timeout: 60000 });

export class SignCareError extends Error {
  constructor(message, status = 502, data = null, service = '') {
    super(friendlyVerificationMessage(message, { service, fallback: 'Verification service is temporarily unavailable. Please try again.' }));
    this.status = status;
    this.data = data;
    this.providerMessage = message;
  }
}

export const signcareConfigured = () => Boolean(signcareConfig.apiKey && signcareConfig.appId);
export const signcareRequestId = (prefix = 'KP') =>
  `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`.toUpperCase();

function headers(requestId) {
  if (!signcareConfigured()) throw new SignCareError('SignCare production credentials are not configured.', 503);
  return {
    'X-API-KEY': signcareConfig.apiKey,
    'X-API-APP-ID': signcareConfig.appId,
    'X-Request-ID': requestId,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function cleanBase64(value = '') {
  return String(value).replace(/^data:[^;]+;base64,/i, '').replace(/\s/g, '');
}

export async function signcareRequest(method, path, data, requestId = signcareRequestId(), options = {}) {
  try {
    const response = await client.request({ method, url: path, data, headers: headers(requestId), ...options });
    if (response.data?.success === false) {
      throw new SignCareError(response.data.message || 'SignCare verification failed.', 422, response.data, path);
    }
    return { requestId: response.data?.request_id || requestId, response: response.data };
  } catch (error) {
    if (error instanceof SignCareError) throw error;
    const body = error.response?.data;
    const status = error.response?.status;
    const providerMessage = body?.message || body?.error_description || body?.error || '';
    const routeMissing = status === 404 && /route\s+not\s+found/i.test(String(providerMessage));
    const message = routeMissing
      ? 'This verification service is not enabled for the current provider account. Please contact support.'
      : providerMessage ||
        (status === 401 ? 'SignCare authentication failed.' : 'Verification service is temporarily unavailable.');
    throw new SignCareError(message, status === 400 ? 400 : status === 401 ? 502 : 503, body || null, path);
  }
}

export const verifyPan = ({ pan, name, dob, consentText, requestId }) => signcareRequest('post', '/api/v1/pan/verify', {
  consent: 'Y', consent_text: consentText, request_id: requestId,
  pan_number: String(pan).toUpperCase(),
  // pan_holder_name is required by SignCare. We always send it — a generic
  // placeholder is fine; the API returns a name_as_per_pan_match boolean
  // rather than echoing the submitted value back, so there is no false-match risk.
  pan_holder_name: String(name || 'Customer').trim() || 'Customer',
  ...(dob ? { dob } : {}),
}, requestId);

export const initAadhaarOvse = ({ channel = 'web', requestId }) => signcareRequest('post', '/api/v1/aadhaar-ovse/init', {
  claims: ['name', 'dob', 'gender', 'photo', 'address', 'pincode', 'state', 'district', 'masked_mobile'],
  request_id: requestId, channel, language: 'english', face_auth: true,
  webhook_url: signcareConfig.webhookUrl,
}, requestId);

export const getAadhaarOvseResult = (txnId, requestId) =>
  signcareRequest('get', `/api/v1/aadhaar-ovse/result/${encodeURIComponent(txnId)}`, undefined, requestId);

export const initDigiLocker = ({ mobileNumber, consentText, requestId }) =>
  signcareRequest('post', '/api/v1/digilocker/init', {
    consent: 'Y',
    consent_text: consentText,
    request_id: requestId,
    // ADHAR is SignCare's document-type code for the issued Aadhaar document.
    docs: ['ADHAR'],
    // SignCare expects snake_case for mobileNumber; camelCase is silently ignored
    // and causes the webhook-URL validation to reject the request.
    mobile_number: mobileNumber,
    using_aadhaar: false,
    webhookUrl: signcareConfig.webhookUrl,
  }, requestId);

export const getDigiLockerDetails = (transactionId, requestId) =>
  signcareRequest(
    'get',
    `/api/v1/digilocker/details/${encodeURIComponent(transactionId)}`,
    undefined,
    requestId,
  );

// FaceLiveness and FaceMatch schemas reject unknown fields, so keep the payload
// exactly aligned with SignCare's OpenAPI definitions.
export const verifyLiveness = ({ image, requestId }) => signcareRequest('post', '/api/v1/FaceLiveness', {
  fileBase64: cleanBase64(image),
  requestId,
}, requestId);

export const verifyFaceMatch = ({ selfie, identityPhoto, requestId }) => signcareRequest('post', '/api/v1/FaceMatch', {
  image1B64: cleanBase64(selfie),
  image2B64: cleanBase64(identityPhoto),
  requestId,
  getNumberOfFaces: true,
}, requestId);

export const verifyBankAccount = ({ accountNumber, ifsc, requestId }) =>
  signcareRequest('post', '/api/v1/Bank/account/verify', {
    // Keep this exactly aligned with SignCare Penny Drop Basic / Trial Center.
    // Extra field aliases can make the provider return statusCode 104
    // ("Max retries exceeded") even when the same details verify in console.
    accountNumber,
    ifsc: String(ifsc).toUpperCase(),
  }, requestId, { timeout: 30000 });

export const verifyUpiName = ({ upiId, consentText, requestId }) =>
  signcareRequest('post', '/api/v1/upi/verification', {
    consent: 'Y',
    consent_text: consentText,
    request_id: requestId,
    customer_upi_id: String(upiId || '').trim().toLowerCase(),
  }, requestId);

export const submitBankStatement = ({ fileBase64, password, accountType, consentText, requestId }) =>
  signcareRequest('post', '/api/v1/Bank/statement-analyser/corporate', {
    consent: 'Y', consent_text: consentText, request_id: requestId,
    file_base64: cleanBase64(fileBase64), accountType: accountType || 'SALARIED',
    webhookUrl: signcareConfig.webhookUrl, ...(password ? { password } : {}),
  }, requestId);

export const getBankStatementAnalysis = ({ orderId, consentText, requestId }) =>
  signcareRequest('post', '/api/v1/Bank/statement-analyser-details/corporate', {
    consent: 'Y', consent_text: consentText, request_id: requestId,
    order_id: orderId, response_type: 'json',
  }, requestId);

export const fetchExperianReport = (payload, requestId) =>
  // request_id must be snake_case; spreading as requestId (camelCase) is silently ignored.
  signcareRequest('post', '/api/v1/CreditBureau', { ...payload, request_id: requestId }, requestId);

export const createESign = (payload, requestId) => signcareRequest('post', '/api/v1/eSign/request', {
  ...payload, referenceId: payload.referenceId || requestId,
  responseUrl: signcareConfig.webhookUrl, returnUrl: signcareConfig.returnUrl,
}, requestId);
export const getESignStatus = (payload, requestId) => signcareRequest('post', '/api/v1/eSign/status', payload, requestId);
export const getESignAudit = (documentId, requestId) =>
  signcareRequest('get', `/api/v1/eSign/audittrail/${encodeURIComponent(documentId)}`, undefined, requestId);
export const createEStamp = (payload, requestId) => signcareRequest('post', '/api/v1/NeSLStamp/init', {
  ...payload, referenceId: payload.referenceId || requestId,
  responseWebhookUrl: signcareConfig.webhookUrl, redirectUrl: signcareConfig.returnUrl,
}, requestId);

export function publicSigncareConfig() {
  return {
    configured: signcareConfigured(), environment: signcareConfig.baseURL.includes('uat-') ? 'uat' : 'production',
    wealthSyncEnabled: signcareConfig.wealthSyncEnabled,
  };
}
