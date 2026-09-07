import crypto from 'crypto';
import fetch from 'node-fetch';
import config from '../config/juspayConsumer.js';

const labels = {
  getSmsToken: 'Get SMS token',
  bindDevice: 'Device binding',
  fetchAccounts: 'Fetch bank accounts',
  checkBalance: 'Check balance',
  verifyVpa: 'Verify VPA',
  setMpin: 'Set UPI PIN',
  changeMpin: 'Change UPI PIN',
  resetMpin: 'Reset UPI PIN',
  sendMoney: 'Send money',
  requestMoney: 'Request money',
  transactionStatus: 'Transaction status',
  listTransactions: 'List transactions',
  listBanks: 'List banks',
  upiNumberAvailability: 'UPI number availability',
  createUpiNumber: 'Create UPI number',
  updateUpiNumber: 'Update UPI number',
  complaintRaise: 'Raise complaint',
  complaintStatus: 'Complaint status',
  upiLiteStatus: 'UPI Lite status',
};

function nowMs() {
  return Date.now().toString();
}

export function consumerRequestId() {
  return `${config.requestIdPrefix}${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`.slice(0, 35);
}

export function consumerSetupStatus() {
  const missing = [];
  for (const [key, value] of Object.entries({
    JUSPAY_CONSUMER_ENABLED: config.enabled,
    JUSPAY_CONSUMER_BASE_URL: config.baseUrl,
    JUSPAY_CONSUMER_MERCHANT_ID: config.merchantId,
    JUSPAY_CONSUMER_MERCHANT_CHANNEL_ID: config.merchantChannelId,
    JUSPAY_CONSUMER_PRIVATE_KEY: config.privateKey,
  })) {
    if (!value) missing.push(key);
  }
  return {
    enabled: config.enabled,
    configured: missing.length === 0,
    missing,
    callbackUrl: config.callbackUrl,
    features: Object.keys(labels).map((key) => ({
      key,
      title: labels[key],
      pathConfigured: Boolean(config.paths[key]),
    })),
  };
}

function requireConfigured(action) {
  const status = consumerSetupStatus();
  if (!status.configured) {
    const error = new Error(`Juspay Consumer Stack is not configured for ${labels[action] || action}: ${status.missing.join(', ')}`);
    error.code = 'JUSPAY_CONSUMER_NOT_CONFIGURED';
    error.status = 503;
    throw error;
  }
  if (!config.paths[action]) {
    const error = new Error(`Juspay Consumer Stack path is not configured for ${labels[action] || action}`);
    error.code = 'JUSPAY_CONSUMER_PATH_MISSING';
    error.status = 503;
    throw error;
  }
}

function signPayload(payload, timestamp) {
  if (!config.privateKey) return '';
  const body = JSON.stringify(payload);
  return crypto
    .createSign('RSA-SHA256')
    .update(`${timestamp}.${body}`)
    .end()
    .sign(config.privateKey, 'base64');
}

export async function callConsumer(action, payload = {}, options = {}) {
  requireConfigured(action);
  const timestamp = nowMs();
  const body = {
    merchantRequestId: payload.merchantRequestId || consumerRequestId(),
    ...payload,
  };
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json',
    'x-merchant-id': config.merchantId,
    'x-merchant-channel-id': config.merchantChannelId,
    'x-timestamp': timestamp,
    'x-merchant-signature': signPayload(body, timestamp),
    'jpupi-routing-id': options.routingId || body.merchantCustomerId || body.merchantRequestId,
  };
  const url = `${config.baseUrl}${config.paths[action]}`;
  const response = await fetch(url, {
    method: options.method || 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(data.responseMessage || data.message || `${labels[action] || action} failed with HTTP ${response.status}`);
    error.status = response.status;
    error.response = data;
    throw error;
  }
  return data;
}

export function notConfiguredPayload(error) {
  return {
    code: error.code || 'JUSPAY_CONSUMER_NOT_READY',
    message: error.message,
    setup: consumerSetupStatus(),
  };
}
