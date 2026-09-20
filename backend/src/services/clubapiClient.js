import axios from 'axios';

import clubapiConfig from '../config/clubapi.js';
import Settings from '../models/Settings.js';

/**
 * Transport for the customer-facing ClubAPI flows (recharge, bill fetch, bill
 * pay, status, operator data).
 *
 * Unlike the older helpers in clubapiUtility.js, these never throw on a
 * ClubAPI-level failure. Every call resolves to an outcome that says *how* it
 * ended, because that decides whether a customer is refunded:
 *
 *   delivery 'not_sent'  - the request never left (no token, DNS/connection
 *                          refused). Nothing was debited at ClubAPI: safe to
 *                          fail and refund.
 *   delivery 'unknown'   - timeout / connection reset. ClubAPI may have
 *                          processed it. Per their docs this must stay PENDING
 *                          and be resolved with a status check or callback.
 *   delivery 'received'  - ClubAPI answered; `data` holds the body.
 */

const NOT_SENT_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN', 'ERR_INVALID_URL', 'CERT_HAS_EXPIRED']);

const http = axios.create({
  baseURL: clubapiConfig.baseURL,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  timeout: 45000,
});

function compact(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

let runtimeCache = { at: 0, value: {} };

/** Admin-editable ClubAPI settings (callback id etc.), cached for a minute. */
export async function runtimeClubapiSettings() {
  if (Date.now() - runtimeCache.at < 60_000) return runtimeCache.value;
  try {
    const settings = await Settings.findOne().select('clubapi').lean();
    runtimeCache = { at: Date.now(), value: settings?.clubapi || {} };
  } catch {
    runtimeCache = { at: Date.now(), value: {} };
  }
  return runtimeCache.value;
}

export function isClubapiConfigured() {
  return Boolean(String(clubapiConfig.token || '').trim());
}

/**
 * POSTs to ClubAPI. Never throws.
 * @returns {Promise<{delivery: 'received'|'not_sent'|'unknown', httpStatus?: number, data?: any, error?: string}>}
 */
export async function postClubapi(endpoint, payload = {}, { timeout } = {}) {
  if (!isClubapiConfigured()) {
    return { delivery: 'not_sent', error: 'ClubAPI token is not configured' };
  }

  try {
    const response = await http.post(endpoint, compact({ token: clubapiConfig.token, ...payload }), {
      ...(timeout ? { timeout } : {}),
    });
    return { delivery: 'received', httpStatus: response.status, data: response.data };
  } catch (error) {
    if (error.response) {
      return { delivery: 'received', httpStatus: error.response.status, data: error.response.data };
    }
    if (NOT_SENT_CODES.has(error.code)) {
      return { delivery: 'not_sent', error: error.message };
    }
    return { delivery: 'unknown', error: error.message || 'No response from ClubAPI' };
  }
}

/** Recharge (mobile / DTH): POST /transaction.php */
export async function sendRecharge({ urid, operatorId, mobile, amount, customerMobile }) {
  const settings = await runtimeClubapiSettings();
  return postClubapi('/transaction.php', {
    urid,
    operatorId,
    mobile,
    amount: String(amount),
    customerMobile,
    cbId: settings.callbackId || clubapiConfig.callbackId,
  });
}

/** BBPS bill fetch: POST /utility/transaction.php with transType=billFetch */
export async function sendBillFetch({ urid, bbpsId, mobile, customerMobile, opvalues = {} }) {
  return postClubapi(
    '/utility/transaction.php',
    {
      urid,
      bbpsId,
      mobile,
      customerMobile,
      transType: 'billFetch',
      ...opvalues,
    },
    { timeout: 30000 }
  );
}

/** BBPS bill payment: POST /transaction.php with bbpsId */
export async function sendBillPayment({ urid, bbpsId, mobile, customerMobile, amount, opvalues = {} }) {
  const settings = await runtimeClubapiSettings();
  return postClubapi('/transaction.php', {
    urid,
    bbpsId,
    mobile,
    customerMobile,
    amount: String(amount),
    cbId: settings.callbackId || clubapiConfig.callbackId,
    ...opvalues,
  });
}

/** POST /utility/transactionStatus.php */
export async function sendStatusCheck({ urid, orderId }) {
  return postClubapi('/utility/transactionStatus.php', { urid, orderId }, { timeout: 20000 });
}

/** POST /utility/operatorList.php */
export async function sendOperatorList() {
  return postClubapi('/utility/operatorList.php', {}, { timeout: 30000 });
}

/** POST /utility/transaction.php with transType=mobilePlan */
export async function sendMobilePlans({ operatorId, urid }) {
  return postClubapi('/utility/transaction.php', { operatorId, urid, transType: 'mobilePlan' }, { timeout: 30000 });
}

/** POST /utility/mobileDetails.php */
export async function sendMobileDetails() {
  return postClubapi('/utility/mobileDetails.php', {}, { timeout: 30000 });
}
