import axios from 'axios';
import crypto from 'crypto';
import dns from 'dns';
import https from 'https';
import signcareConfig from '../config/signcare.js';
import { friendlyVerificationMessage } from '../utils/friendlyProviderErrors.js';

// SignCare sits behind rotating AWS addresses. A stale /etc/hosts pin
// (13.200.111.121) made every call hang until timeout, so resolve through real
// DNS (dns.resolve4 ignores /etc/hosts) and stay on IPv4, which the server's
// IPv6 route could not reach. Falls back to the OS resolver if DNS fails.
export function signcareIpv4Lookup(hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  const all = typeof options === 'object' && options?.all === true;
  const fallback = () => dns.lookup(hostname, { family: 4, all }, cb);
  dns.resolve4(hostname, (error, addresses) => {
    if (error || !addresses?.length) return fallback();
    const shuffled = [...addresses].sort(() => Math.random() - 0.5);
    if (all) return cb(null, shuffled.map((address) => ({ address, family: 4 })));
    return cb(null, shuffled[0], 4);
  });
}

const httpsAgent = new https.Agent({ keepAlive: true, lookup: signcareIpv4Lookup });
const client = axios.create({ baseURL: signcareConfig.baseURL, timeout: 60000, httpsAgent });

export class SignCareError extends Error {
  constructor(message, status = 502, data = null, service = '') {
    super(friendlyVerificationMessage(message, { service, fallback: 'Verification service is temporarily unavailable. Please try again.' }));
    this.status = status;
    this.data = data;
    this.providerMessage = message;
    // The message above is already rewritten for customers, so the error
    // handler may show it even on a 5xx.
    this.expose = true;
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

const SENSITIVE_LOG_KEY = /pan|aadhaar|aadhar|mobile|phone|account|email|dob|birth|address|upi/i;
const BINARY_LOG_KEY = /base64|image|photo|file|selfie|content|pdf|xml|excel/i;

function maskForLog(value) {
  const text = String(value);
  return text.length <= 4 ? '****' : `${'*'.repeat(Math.min(text.length - 4, 8))}${text.slice(-4)}`;
}

// Logs keep the shape of a request/response but never full identity numbers,
// contact details or document payloads.
export function loggableSigncarePayload(data, depth = 0) {
  if (!data || typeof data !== 'object') return data;
  if (depth > 3) return '[object]';
  if (Array.isArray(data)) return data.slice(0, 10).map((item) => loggableSigncarePayload(item, depth + 1));
  const payload = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && BINARY_LOG_KEY.test(key)) {
      payload[key] = `base64:${value.length}`;
    } else if ((typeof value === 'string' || typeof value === 'number') && SENSITIVE_LOG_KEY.test(key) && !/url|type|status|match|name$/i.test(key)) {
      payload[key] = maskForLog(value);
    } else if (typeof value === 'string' && value.length > 160) {
      payload[key] = `${value.slice(0, 80)}...(${value.length} chars)`;
    } else if (value && typeof value === 'object') {
      payload[key] = loggableSigncarePayload(value, depth + 1);
    } else {
      payload[key] = value;
    }
  }
  return payload;
}

export function buildBankAccountVerifyPayload({ accountNumber, ifsc, ifscCode, accountNo } = {}) {
  const numericAccountNumber = String(accountNumber ?? accountNo ?? '').trim();
  const normalizedIfsc = String(ifsc ?? ifscCode ?? '').trim().toUpperCase();
  return {
    accountNumber: numericAccountNumber,
    ifsc: normalizedIfsc,
  };
}

export function buildCorporateBankStatementPayload({
  fileBase64,
  password,
  accountType,
  consentText,
  requestId,
  webhookUrl,
} = {}) {
  const payload = {
    consent: 'Y',
    consent_text: String(consentText || 'I hereby declare my consent agreement for fetching my information via SignCare API').trim(),
    request_id: String(requestId || '').trim(),
    file_base64: cleanBase64(fileBase64),
    webhookUrl: String(webhookUrl || signcareConfig.webhookUrl || '').trim(),
    accountType: String(accountType || 'SALARIED').toUpperCase(),
  };
  if (password) payload.password = String(password);
  return payload;
}

export function buildBankStatementDetailsPayload({ orderId, consentText, requestId, responseType = 'json' } = {}) {
  return {
    consent: 'Y',
    consent_text: String(consentText || 'I hereby declare my consent agreement for fetching my information via SignCare API').trim(),
    request_id: String(requestId || '').trim(),
    order_id: String(orderId || '').trim(),
    response_type: String(responseType || 'json').trim(),
  };
}

/**
 * One SignCare call.
 *
 * options.timeout          per-call deadline in ms (defaults to the client's 60s;
 *                          every loan call passes its own budget, see SIGNCARE_TIMEOUTS)
 * options.retry            retry once on a transient failure. Only for idempotent
 *                          reads/status checks - paid or document-creating calls
 *                          (bureau, eSign request, face, penny drop, statement
 *                          submit) must never be sent twice.
 * options.keepClientStatus report the provider's own 4xx (e.g. 404 "not ready yet")
 *                          instead of folding it into 503, so the caller can tell
 *                          "pending" from "down".
 */
export async function signcareRequest(method, path, data, requestId = signcareRequestId(), options = {}) {
  const { keepClientStatus = false, retry = false, ...axiosOptions } = options;
  const logPath = path.replace(/\/[0-9a-f-]{16,}$/i, '/:id');
  const request = async () => {
    const startedAt = Date.now();
    try {
      console.info('[SignCare request]', { method, path: logPath, requestId, payload: loggableSigncarePayload(data) });
      const response = await client.request({ method, url: path, data, headers: headers(requestId), ...axiosOptions });
      if (response.data?.success === false) {
        console.warn('[SignCare rejected]', { method, path: logPath, requestId, status: response.status, ms: Date.now() - startedAt, message: response.data.message });
        throw new SignCareError(response.data.message || 'SignCare verification failed.', 422, response.data, path);
      }
      console.info('[SignCare response]', { method, path: logPath, requestId, status: response.status, ms: Date.now() - startedAt, payload: loggableSigncarePayload(response.data) });
      return { requestId: response.data?.request_id || requestId, response: response.data };
    } catch (error) {
      if (error instanceof SignCareError) throw error;
      const body = error.response?.data;
      const status = error.response?.status;
      const providerMessage = body?.message || body?.error_description || body?.error || '';
      const routeMissing = status === 404 && /route\s+not\s+found/i.test(String(providerMessage));
      const timedOut = !error.response && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || /timeout/i.test(error.message || ''));
      const message = routeMissing
        ? 'This verification service is not enabled for the current provider account. Please contact support.'
        : timedOut ? 'SignCare request timeout.'
        : providerMessage ||
          (status === 401 ? 'SignCare authentication failed.' : 'Verification service is temporarily unavailable.');
      console.error('[SignCare error]', { method, path: logPath, requestId, status, code: error.code, ms: Date.now() - startedAt, providerMessage: message, response: loggableSigncarePayload(body) });
      const clientStatus = keepClientStatus && status >= 400 && status < 500 && status !== 401 && status !== 403;
      const error_ = new SignCareError(message, clientStatus || status === 400 ? status : status === 401 ? 502 : 503, body || null, path);
      error_.timedOut = timedOut;
      throw error_;
    }
  };

  try {
    return await request();
  } catch (error) {
    const transient = retry && error instanceof SignCareError && (error.status === 502 || error.status === 503);
    if (!transient) throw error;
    await new Promise((resolve) => setTimeout(resolve, 350));
    return request();
  }
}

// Per-call budgets. Each loan route must answer inside the reverse proxy's 60s
// window, and the app waits a little longer than the route (see loan_service.dart).
export const SIGNCARE_TIMEOUTS = Object.freeze({
  pan: 20_000,
  digilocker: 20_000,
  ovse: 20_000,
  liveness: 25_000,
  faceMatch: 25_000,
  bank: 12_000,
  upi: 20_000,
  statementSubmit: 45_000,
  statementDetails: 20_000,
  bureau: 50_000,
  eSignRequest: 30_000,
  eSignStatus: 15_000,
  eSignAudit: 10_000,
  eStamp: 30_000,
});

export const verifyPan = ({ pan, name, dob, consentText, requestId }) => signcareRequest('post', '/api/v1/pan/verify', {
  consent: 'Y', consent_text: consentText, request_id: requestId,
  pan_number: String(pan).toUpperCase(),
  // pan_holder_name is required by SignCare. We always send it — a generic
  // placeholder is fine; the API returns a name_as_per_pan_match boolean
  // rather than echoing the submitted value back, so there is no false-match risk.
  pan_holder_name: String(name || 'Customer').trim() || 'Customer',
  ...(dob ? { dob } : {}),
}, requestId, { timeout: SIGNCARE_TIMEOUTS.pan });

export const initAadhaarOvse = ({ channel = 'web', requestId }) => signcareRequest('post', '/api/v1/aadhaar-ovse/init', {
  claims: ['name', 'dob', 'gender', 'photo', 'address', 'pincode', 'state', 'district', 'masked_mobile'],
  request_id: requestId, channel, language: 'english', face_auth: true,
  webhook_url: signcareConfig.webhookUrl,
}, requestId, { timeout: SIGNCARE_TIMEOUTS.ovse });

export const getAadhaarOvseResult = (txnId, requestId) =>
  signcareRequest('get', `/api/v1/aadhaar-ovse/result/${encodeURIComponent(txnId)}`, undefined, requestId, { timeout: SIGNCARE_TIMEOUTS.ovse, retry: true });

export function buildDigiLockerInitPayload({ mobileNumber, consentText, requestId } = {}) {
  return {
    consent: 'Y',
    consent_text: consentText,
    request_id: requestId,
    // ADHAR is SignCare's document-type code for the issued Aadhaar document.
    docs: ['ADHAR'],
    mobileNumber,
    using_aadhaar: false,
    webhookUrl: signcareConfig.webhookUrl,
    // Without this SignCare ends on its own app.signcare.io page, so the
    // in-app WebView never learns that consent finished.
    redirectUrl: signcareConfig.digilockerRedirectUrl,
  };
}

export const initDigiLocker = (payload) =>
  signcareRequest('post', '/api/v1/digilocker/init', buildDigiLockerInitPayload(payload), payload.requestId, { timeout: SIGNCARE_TIMEOUTS.digilocker });

export const getDigiLockerDetails = (transactionId, requestId) =>
  signcareRequest(
    'get',
    `/api/v1/digilocker/details/${encodeURIComponent(transactionId)}`,
    undefined,
    requestId,
    { timeout: SIGNCARE_TIMEOUTS.digilocker, keepClientStatus: true, retry: true },
  );

// FaceLiveness and FaceMatch schemas reject unknown fields, so keep the payload
// exactly aligned with SignCare's OpenAPI definitions.
export const verifyLiveness = ({ image, requestId }) => signcareRequest('post', '/api/v1/FaceLiveness', {
  fileBase64: cleanBase64(image),
  requestId,
}, requestId, { timeout: SIGNCARE_TIMEOUTS.liveness });

export const verifyFaceMatch = ({ selfie, identityPhoto, requestId }) => signcareRequest('post', '/api/v1/FaceMatch', {
  image1B64: cleanBase64(selfie),
  image2B64: cleanBase64(identityPhoto),
  requestId,
  getNumberOfFaces: true,
}, requestId, { timeout: SIGNCARE_TIMEOUTS.faceMatch });

export const verifyBankAccount = ({ accountNumber, ifsc, ifscCode, accountNo, requestId }) =>
  signcareRequest('post', '/api/v1/Bank/account/verify', buildBankAccountVerifyPayload({
    accountNumber,
    ifsc,
    ifscCode,
    accountNo,
  }), requestId, { timeout: SIGNCARE_TIMEOUTS.bank });

export const verifyUpiName = ({ upiId, consentText, requestId }) =>
  signcareRequest('post', '/api/v1/upi/verification', {
    consent: 'Y',
    consent_text: consentText,
    request_id: requestId,
    customer_upi_id: String(upiId || '').trim().toLowerCase(),
  }, requestId, { timeout: SIGNCARE_TIMEOUTS.upi });

export const submitBankStatement = ({ fileBase64, password, accountType, consentText, requestId, webhookUrl }) =>
  signcareRequest('post', '/api/v1/Bank/statement-analyser/corporate', buildCorporateBankStatementPayload({
    fileBase64,
    password,
    accountType,
    consentText,
    requestId,
    webhookUrl,
  }), requestId, { timeout: SIGNCARE_TIMEOUTS.statementSubmit });

export const getBankStatementAnalysis = ({ orderId, consentText, requestId, responseType = 'json' }) =>
  signcareRequest('post', '/api/v1/Bank/statement-analyser-details/corporate', buildBankStatementDetailsPayload({
    orderId,
    consentText,
    requestId,
    responseType,
  }), requestId, { timeout: SIGNCARE_TIMEOUTS.statementDetails, retry: true });

export const fetchExperianReport = (payload, requestId) =>
  // request_id must be snake_case; spreading as requestId (camelCase) is silently ignored.
  signcareRequest('post', '/api/v1/CreditBureau', { ...payload, request_id: requestId }, requestId, { timeout: SIGNCARE_TIMEOUTS.bureau });

export const createESign = (payload, requestId) => signcareRequest('post', '/api/v1/eSign/request', {
  ...payload, referenceId: payload.referenceId || requestId,
  responseUrl: signcareConfig.webhookUrl, returnUrl: signcareConfig.returnUrl,
}, requestId, { timeout: SIGNCARE_TIMEOUTS.eSignRequest });
export const getESignStatus = (payload, requestId, { retry = true } = {}) =>
  signcareRequest('post', '/api/v1/eSign/status', payload, requestId, { timeout: SIGNCARE_TIMEOUTS.eSignStatus, retry });
export const getESignAudit = (documentId, requestId) =>
  signcareRequest('get', `/api/v1/eSign/audittrail/${encodeURIComponent(documentId)}`, undefined, requestId, { timeout: SIGNCARE_TIMEOUTS.eSignAudit });

export function publicSigncareConfig() {
  return {
    configured: signcareConfigured(), environment: signcareConfig.baseURL.includes('uat-') ? 'uat' : 'production',
    wealthSyncEnabled: signcareConfig.wealthSyncEnabled,
  };
}
