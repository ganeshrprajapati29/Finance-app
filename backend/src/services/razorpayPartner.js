import 'dotenv/config';
import crypto from 'crypto';
import { privateBusinessDocumentDeliveryUrl } from './cloudinary.js';

const clean = (value) => String(value || '').trim();
const partnerConfig = () => ({
  clientId: clean(process.env.RAZORPAY_PARTNER_CLIENT_ID),
  clientSecret: clean(process.env.RAZORPAY_PARTNER_CLIENT_SECRET),
  mode: clean(process.env.RAZORPAY_PARTNER_MODE).toLowerCase() || 'test',
  redirectUri: clean(process.env.RAZORPAY_PARTNER_OAUTH_REDIRECT_URI),
});

let tokenCache = null;

export class RazorpayPartnerError extends Error {
  constructor(message, { status = 503, code = 'RAZORPAY_PARTNER_UNAVAILABLE', details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

export async function getRazorpayPartnerToken() {
  const config = partnerConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new RazorpayPartnerError('Business onboarding is temporarily unavailable. Please try again later.');
  }
  if (!['test', 'live'].includes(config.mode)) {
    throw new RazorpayPartnerError('Business onboarding is temporarily unavailable. Please contact support.');
  }
  if (tokenCache?.expiresAt > Date.now() + 60_000) return tokenCache.accessToken;

  try {
    const response = await fetch('https://auth.razorpay.com/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      grant_type: 'client_credentials', mode: config.mode,
      client_id: config.clientId, client_secret: config.clientSecret,
    }), signal: AbortSignal.timeout(20_000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`OAuth HTTP ${response.status}`);
    if (!data?.access_token) throw new Error('Token was not returned');
    tokenCache = { accessToken: data.access_token, expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000) };
    return tokenCache.accessToken;
  } catch (error) {
    console.error('[razorpay-partner] token request failed:', error.message);
    throw new RazorpayPartnerError('Business onboarding could not be started. Please try again later.');
  }
}

export function razorpayOAuthAuthorizationUrl(state) {
  const config = partnerConfig();
  if (!config.clientId || !config.redirectUri) {
    throw new RazorpayPartnerError('Business account connection is temporarily unavailable. Please try again later.');
  }
  const query = new URLSearchParams({
    response_type: 'code', client_id: config.clientId, redirect_uri: config.redirectUri,
    scope: 'read_write', state, mode: config.mode,
  });
  return `https://auth.razorpay.com/authorize?${query.toString()}`;
}

export async function exchangeRazorpayOAuthCode(code) {
  const config = partnerConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new RazorpayPartnerError('Business account connection is temporarily unavailable. Please try again later.');
  }
  try {
    const response = await fetch('https://auth.razorpay.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code', code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, mode: config.mode }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.access_token) throw new Error(data?.error?.description || `OAuth HTTP ${response.status}`);
    return data;
  } catch (error) {
    console.error('[razorpay-partner] OAuth code exchange failed:', error.message);
    throw new RazorpayPartnerError('Razorpay account connection could not be completed. Please try again.');
  }
}

export function encryptRazorpayOAuthSecret(value) {
  const plaintext = String(value || '');
  const secret = clean(process.env.JWT_ACCESS_SECRET);
  if (!plaintext || !secret) return undefined;
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptRazorpayOAuthSecret(value) {
  const secret = clean(process.env.JWT_ACCESS_SECRET);
  const [ivText, tagText, encryptedText] = String(value || '').split('.');
  if (!secret || !ivText || !tagText || !encryptedText) return '';
  try {
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8');
  } catch { return ''; }
}

export async function razorpayMerchantRequest(accessToken, method, path, data, { accountId } = {}) {
  if (!accessToken) throw new RazorpayPartnerError('Connect your Razorpay business account before using QR collections.', { status: 409, code: 'RAZORPAY_OAUTH_REQUIRED' });
  try {
    const response = await fetch(`https://api.razorpay.com${path}`, {
      method: method.toUpperCase(),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(accountId ? { 'X-Razorpay-Account': accountId } : {}),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(body?.error?.description || `Razorpay HTTP ${response.status}`); error.httpStatus = response.status; throw error; }
    return body;
  } catch (error) {
    console.error('[razorpay-partner] merchant request failed:', method, path, error.httpStatus || error.message);
    throw new RazorpayPartnerError(error.httpStatus === 401 ? 'Your Razorpay connection has expired. Connect the account again.' : 'Razorpay could not complete this request. Please try again.', { status: error.httpStatus === 401 ? 401 : 502, code: 'RAZORPAY_MERCHANT_REQUEST_FAILED' });
  }
}

export async function razorpayPartnerV1Request(method, path, data, options = {}) {
  return razorpayMerchantRequest(
    await getRazorpayPartnerToken(),
    method,
    path,
    data,
    options,
  );
}

export const requestRazorpayProductConfiguration = (accountId, payload) =>
  razorpayPartnerRequest('post', `/accounts/${encodeURIComponent(accountId)}/products`, payload);
export const updateRazorpayProductConfiguration = (accountId, productId, payload) =>
  razorpayPartnerRequest('patch', `/accounts/${encodeURIComponent(accountId)}/products/${encodeURIComponent(productId)}`, payload);
export const fetchRazorpayProductConfiguration = (accountId, productId) =>
  razorpayPartnerRequest('get', `/accounts/${encodeURIComponent(accountId)}/products/${encodeURIComponent(productId)}`);

export async function razorpayPartnerRequest(method, path, data) {
  const accessToken = await getRazorpayPartnerToken();
  try {
    const response = await fetch(`https://api.razorpay.com/v2${path}`, { method: method.toUpperCase(), headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }), signal: AbortSignal.timeout(30_000) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const providerError = new Error(body?.error?.description || body?.error?.reason || `Razorpay HTTP ${response.status}`); providerError.httpStatus = response.status; throw providerError; }
    return body;
  } catch (error) {
    const providerMessage = error.message || 'Razorpay could not process the onboarding request.';
    console.error('[razorpay-partner] request failed:', method, path, error.httpStatus || error.message);
    throw new RazorpayPartnerError(providerMessage, { status: error.httpStatus === 400 ? 400 : 502, code: 'RAZORPAY_PARTNER_REQUEST_FAILED' });
  }
}

export async function uploadRazorpayAccountDocument(accountId, {
  documentType,
  fileUrl,
}) {
  const sourceUrl = String(fileUrl || '').startsWith('private://') ? privateBusinessDocumentDeliveryUrl(fileUrl) : String(fileUrl || '');
  if (!/^https:\/\//i.test(sourceUrl)) {
    throw new RazorpayPartnerError('Upload the document securely before submitting it for verification.', {
      status: 400,
      code: 'DOCUMENT_URL_INVALID',
    });
  }
  try {
    const fileResponse = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000) });
    if (!fileResponse.ok) throw new Error(`Document download HTTP ${fileResponse.status}`);
    const bytes = await fileResponse.arrayBuffer();
    const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
    const isPdf = /application\/pdf/i.test(contentType) || /\.pdf(?:$|\?)/i.test(sourceUrl);
    const limit = isPdf ? 2 * 1024 * 1024 : 4 * 1024 * 1024;
    if (!bytes.byteLength || bytes.byteLength > limit) {
      throw new RazorpayPartnerError('Use a JPG or PNG up to 4 MB, or a PDF up to 2 MB.', {
        status: 400,
        code: 'DOCUMENT_SIZE_INVALID',
      });
    }
    const path = new URL(sourceUrl).pathname;
    const filename = decodeURIComponent(path.split('/').pop() || 'business-document');
    const form = new FormData();
    form.append(
      'file',
      new Blob([bytes], { type: contentType }),
      filename,
    );
    form.append('document_type', documentType);
    const accessToken = await getRazorpayPartnerToken();
    const response = await fetch(
      `https://api.razorpay.com/v2/accounts/${encodeURIComponent(accountId)}/documents`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
        signal: AbortSignal.timeout(30_000),
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.description || body?.error?.reason || `Razorpay HTTP ${response.status}`);
      error.httpStatus = response.status;
      throw error;
    }
    return body;
  } catch (error) {
    if (error instanceof RazorpayPartnerError) throw error;
    console.error('[razorpay-partner] account document upload failed:', error.message);
    throw new RazorpayPartnerError('Razorpay could not submit this document. Please review the file and try again.', {
      status: error.httpStatus === 400 ? 400 : 502,
      code: 'RAZORPAY_DOCUMENT_UPLOAD_FAILED',
    });
  }
}

export const createRazorpaySubMerchant = (payload) => razorpayPartnerRequest('post', '/accounts', payload);
export const updateRazorpaySubMerchant = (accountId, payload) =>
  razorpayPartnerRequest('patch', `/accounts/${encodeURIComponent(accountId)}`, payload);
export const createRazorpayStakeholder = (accountId, payload) => razorpayPartnerRequest('post', `/accounts/${encodeURIComponent(accountId)}/stakeholders`, payload);
export const fetchRazorpaySubMerchant = (accountId) => razorpayPartnerRequest('get', `/accounts/${encodeURIComponent(accountId)}`);
export const fetchRazorpayTerms = () => razorpayPartnerRequest('get', '/products/payments/tnc');

export function mapRazorpayAccountStatus(status) {
  return ({ created: 'SUBMITTED', under_review: 'UNDER_REVIEW', needs_clarification: 'NEEDS_CLARIFICATION', activated: 'APPROVED', rejected: 'REJECTED', suspended: 'SUSPENDED' })[String(status || '').toLowerCase()] || 'SUBMITTED';
}
