import axios from 'axios';
import crypto from 'crypto';
import signcareConfig from '../config/signcare.js';

const client = axios.create({ baseURL: signcareConfig.baseURL, timeout: 60000 });

export class SignCareError extends Error {
  constructor(message, status = 502, data = null) {
    super(message);
    this.status = status;
    this.data = data;
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

export async function signcareRequest(method, path, data, requestId = signcareRequestId()) {
  try {
    const response = await client.request({ method, url: path, data, headers: headers(requestId) });
    if (response.data?.success === false) {
      throw new SignCareError(response.data.message || 'SignCare verification failed.', 422, response.data);
    }
    return { requestId: response.data?.request_id || requestId, response: response.data };
  } catch (error) {
    if (error instanceof SignCareError) throw error;
    const body = error.response?.data;
    const status = error.response?.status;
    const message = body?.message || body?.error_description || body?.error ||
      (status === 401 ? 'SignCare authentication failed.' : 'Verification service is temporarily unavailable.');
    throw new SignCareError(message, status === 400 ? 400 : status === 401 ? 502 : 503, body || null);
  }
}

export const verifyPan = ({ pan, name, dob, consentText, requestId }) => signcareRequest('post', '/api/v1/pan/verify', {
  consent: 'Y', consent_text: consentText, request_id: requestId,
  pan_number: String(pan).toUpperCase(), pan_holder_name: name, ...(dob ? { dob } : {}),
}, requestId);

export const initAadhaarOvse = ({ channel = 'web', requestId }) => signcareRequest('post', '/api/v1/aadhaar-ovse/init', {
  claims: ['name', 'dob', 'gender', 'photo', 'address', 'pincode', 'state', 'district', 'masked_mobile'],
  request_id: requestId, channel, language: 'english', face_auth: true,
  webhook_url: signcareConfig.webhookUrl,
}, requestId);

export const getAadhaarOvseResult = (txnId, requestId) =>
  signcareRequest('get', `/api/v1/aadhaar-ovse/result/${encodeURIComponent(txnId)}`, undefined, requestId);

export const verifyLiveness = ({ image, requestId }) => signcareRequest('post', '/api/v1/FaceLiveness', {
  fileBase64: cleanBase64(image), requestId,
}, requestId);

export const verifyFaceMatch = ({ selfie, identityPhoto, requestId }) => signcareRequest('post', '/api/v1/FaceMatch', {
  image1B64: cleanBase64(selfie), image2B64: cleanBase64(identityPhoto),
  getNumberOfFaces: true, requestId,
}, requestId);

export const verifyBankAccount = ({ accountNumber, ifsc, consentText, requestId }) =>
  signcareRequest('post', '/api/v1/Bank/account/verify', {
    consent: 'Y', consent_text: consentText, request_id: requestId, accountNumber, ifsc: String(ifsc).toUpperCase(),
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
  signcareRequest('post', '/api/v1/CreditBureau', { ...payload, requestId }, requestId);

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
