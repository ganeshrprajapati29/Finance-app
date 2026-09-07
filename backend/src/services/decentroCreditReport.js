import axios from 'axios';
import crypto from 'crypto';
import decentroConfig from '../config/decentro.js';

const apiClient = axios.create({
  baseURL: decentroConfig.baseURL,
  timeout: 45000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
});

const endpoints = {
  summary: '/v2/financial_services/credit_bureau/credit_report/summary',
  customerData: '/v2/financial_services/credit_bureau/credit_report/customer_data',
  score: '/v2/financial_services/credit_bureau/credit_score'
};

export function decentroConfigured() {
  return Boolean(decentroConfig.clientId && decentroConfig.clientSecret);
}

export function generateReferenceId(prefix = 'KPCR') {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${stamp}${rand}`.slice(0, 32);
}

function cleanPayload(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function headers(extra = {}) {
  if (!decentroConfigured()) {
    throw new Error('Decentro client credentials are not configured');
  }
  const result = {
    client_id: decentroConfig.clientId,
    client_secret: decentroConfig.clientSecret,
    ...extra
  };
  if (decentroConfig.financialServicesModuleSecret) {
    result.module_secret = decentroConfig.financialServicesModuleSecret;
  }
  if (decentroConfig.financialServicesProviderSecret) {
    result.provider_secret = decentroConfig.financialServicesProviderSecret;
  }
  return result;
}

export function maskPan(pan = '') {
  const value = String(pan || '').trim().toUpperCase();
  if (value.length < 6) return value ? '***' : '';
  return `${value.slice(0, 3)}****${value.slice(-3)}`;
}

export function sanitizeCreditPayload(payload = {}) {
  return {
    ...payload,
    pan: maskPan(payload.pan),
    id_number: maskPan(payload.id_number),
    document_id: maskPan(payload.document_id)
  };
}

export function normalizeCreditReportInput(input = {}, user = {}) {
  const referenceId = input.referenceId || generateReferenceId();
  const name = String(input.name || user.name || '').trim();
  const mobile = String(input.mobile || user.mobile || '').replace(/\D/g, '').slice(-10);
  const pan = String(input.pan || input.documentId || input.document_id || input.id_number || '').trim().toUpperCase();
  const purpose = String(input.purpose || input.consentPurpose || 'For loan eligibility assessment').trim();
  const inquiryPurpose = String(input.inquiryPurpose || input.inquiry_purpose || 'PL').trim().toUpperCase();
  const addressType = String(input.addressType || input.address_type || 'H').trim().toUpperCase();

  return cleanPayload({
    reference_id: referenceId,
    consent: input.consent === true || input.consent === 'true',
    consent_purpose: purpose,
    name,
    mobile,
    document_type: input.documentType || input.document_type || 'PAN',
    document_id: pan,
    date_of_birth: input.dob || input.dateOfBirth,
    address_type: addressType,
    address: input.address,
    pincode: input.pincode,
    inquiry_purpose: inquiryPurpose,
    bureau: input.bureau,
    generate_pdf: input.generatePdf === true || input.generate_pdf === true,
    report_type: input.reportType || input.report_type
  });
}

async function postDecentro(endpoint, payload) {
  try {
    const response = await apiClient.post(endpoint, cleanPayload(payload), { headers: headers() });
    return response.data;
  } catch (error) {
    const data = error.response?.data;
    const message = data?.message || data?.error || data?.response_message || error.message || 'Decentro request failed';
    const wrapped = new Error(message);
    wrapped.status = error.response?.status;
    wrapped.data = data;
    throw wrapped;
  }
}

export async function fetchCreditReportSummary(payload) {
  return postDecentro(endpoints.summary, payload);
}

export async function fetchCreditReportCustomerData(payload) {
  return postDecentro(endpoints.customerData, payload);
}

export async function fetchCreditScore(payload) {
  return postDecentro(endpoints.score, payload);
}

export function presentDecentroStatus() {
  return {
    environment: decentroConfig.env,
    baseURL: decentroConfig.baseURL,
    clientConfigured: Boolean(decentroConfig.clientId),
    financialServicesModuleConfigured: Boolean(decentroConfig.financialServicesModuleSecret),
    financialServicesProviderConfigured: Boolean(decentroConfig.financialServicesProviderSecret),
    paymentsClientConfigured: Boolean(decentroConfig.paymentsClientId),
    paymentsMasterConsumerConfigured: Boolean(decentroConfig.paymentsMasterConsumerUrn),
    whitelistIp: process.env.PUBLIC_SERVER_IP || '72.60.102.36',
    endpoints
  };
}
