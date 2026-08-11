import axios from 'axios';
import clubapiConfig from '../config/clubapi.js';

const apiClient = axios.create({
  baseURL: clubapiConfig.baseURL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

function requireToken() {
  if (!clubapiConfig.token) throw new Error('ClubAPI token is not configured');
  return clubapiConfig.token;
}

export function generateClubUrid(prefix = 'KP') {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}${stamp}${rand}`.slice(0, 20);
}

function withToken(payload = {}) {
  return { token: requireToken(), ...payload };
}

function cleanPayload(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

async function postClub(endpoint, payload = {}) {
  return apiClient.post(endpoint, cleanPayload(withToken(payload)));
}

function rejectClubError(data, fallbackMessage) {
  const status = String(data?.status || '').toUpperCase();
  const message = String(data?.message || data?.resText || '');
  if (
    ['FAILED', 'FAILURE', 'ERROR'].includes(status) ||
    /unauthori[sz]ed|invalid|failed|error|not active/i.test(message)
  ) {
    throw new Error(message || fallbackMessage);
  }
  return data;
}

export async function callClubAPITransaction(payload = {}) {
  try {
    const response = await postClub('/transaction.php', payload);
    return rejectClubError(response.data, 'ClubAPI transaction failed');
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.resText || error.message || 'ClubAPI transaction failed');
  }
}

export async function callClubAPIUtility(payload = {}) {
  try {
    const response = await postClub('/utility/transaction.php', payload);
    return rejectClubError(response.data, 'ClubAPI utility request failed');
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.resText || error.message || 'ClubAPI utility request failed');
  }
}

// Utility APIs

// Transaction Status
export async function getTransactionStatus({ urid, orderId }) {
  try {
    const response = await postClub('/utility/transactionStatus.php', {
      urid,
      orderId
    });
    return rejectClubError(response.data, 'Transaction status check failed');
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.resText || error.message || 'Transaction status check failed');
  }
}

// Balance
export async function getBalance() {
  try {
    const response = await postClub('/utility/balance.php');
    return rejectClubError(response.data, 'Balance fetch failed');
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.resText || error.message || 'Balance fetch failed');
  }
}

// Operator List
export async function getOperatorList() {
  try {
    const response = await postClub('/utility/operatorList.php');
    return rejectClubError(response.data, 'Operator list fetch failed');
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.resText || error.message || 'Operator list fetch failed');
  }
}

// Dispute
export async function raiseDispute({ orderId }) {
  try {
    const response = await postClub('/utility/dispute.php', {
      orderId
    });
    return rejectClubError(response.data, 'Dispute raise failed');
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.resText || error.message || 'Dispute raise failed');
  }
}

// State List
export async function getStateList() {
  try {
    const response = await postClub('/utility/stateList.php');
    return rejectClubError(response.data, 'State list fetch failed');
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.resText || error.message || 'State list fetch failed');
  }
}

// Operator Plans (Mobile Plan Finder)
export async function getOperatorPlans({ operatorId }) {
  try {
    const response = await postClub('/utility/transaction.php', {
      operatorId,
      transType: 'mobilePlan'
    });
    return rejectClubError(response.data, 'Operator plans fetch failed');
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.resText || error.message || 'Operator plans fetch failed');
  }
}

// Mobile Detail Finder
export async function getMobileDetails() {
  try {
    const response = await postClub('/utility/mobileDetails.php');
    return rejectClubError(response.data, 'Mobile details fetch failed');
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.resText || error.message || 'Mobile details fetch failed');
  }
}

// Bank Account Validation
export async function validateBankAccount({ urid, customerMobile, accountNumber, ifscCode }) {
  try {
    const response = await postClub('/transaction.php', {
      urid,
      customerMobile,
      operatorId: '233',
      accountNumber,
      ifscCode
    });
    return rejectClubError(response.data, 'Bank account validation failed');
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.resText || error.message || 'Bank account validation failed');
  }
}

// Recharge Amount Validation
export async function validateRechargeAmount({ urid, mobile, operatorId, rechargeAmount, transType }) {
  try {
    const response = await postClub('/utility/transaction.php', {
      urid,
      mobile,
      operatorId,
      rechargeAmount,
      transType
    });
    return rejectClubError(response.data, 'Recharge amount validation failed');
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.resText || error.message || 'Recharge amount validation failed');
  }
}

export async function validateUpiName({ upiId, urid }) {
  return callClubAPIUtility({
    upiId: String(upiId || '').trim().toLowerCase(),
    urid: urid || generateClubUrid('KPU'),
    transType: 'upiName'
  });
}

export async function sendAadhaarOtp({ aadhaarNumber, aadhaarMobile, urid }) {
  return callClubAPIUtility({
    aadhaarNumber,
    aadhaarMobile,
    urid: urid || generateClubUrid('KPA'),
    transType: 'aadhaarSendOtp'
  });
}

export async function verifyAadhaarOtp({ aadhaarNumber, aadhaarMobile, otp, otpSessionId, urid }) {
  return callClubAPIUtility({
    aadhaarNumber,
    aadhaarMobile,
    otp,
    otpSessionId,
    urid,
    transType: 'aadhaarVerifyOtp'
  });
}

export async function verifyPan({ pan, urid }) {
  return callClubAPIUtility({
    pan: String(pan || '').toUpperCase(),
    urid: urid || generateClubUrid('KPP'),
    transType: 'panVerify'
  });
}

export async function registerOutlet(payload = {}) {
  return callClubAPIUtility(cleanPayload({
    ...payload,
    pan: payload.pan ? String(payload.pan).toUpperCase() : payload.pan,
    ifscCode: payload.ifscCode ? String(payload.ifscCode).toUpperCase() : payload.ifscCode,
    bankIfscCode: payload.bankIfscCode ? String(payload.bankIfscCode).toUpperCase() : payload.bankIfscCode,
    urid: payload.urid || generateClubUrid('KOR'),
    transType: payload.transType || 'outletRegister'
  }));
}

export async function verifyOutletOtp(payload = {}) {
  return callClubAPIUtility(cleanPayload({
    ...payload,
    urid: payload.urid || generateClubUrid('KOV'),
    transType: payload.transType || 'outletRegisterVerify'
  }));
}

export async function getOutletStatus({ outletMobile, mobile, urid, transType }) {
  return callClubAPIUtility(cleanPayload({
    outletMobile,
    mobile,
    urid: urid || generateClubUrid('KOS'),
    transType: transType || 'outletStatus'
  }));
}

export async function fetchBbpsBill({ mobile, bbpsId, customerMobile, opvalue1, opvalue2, opvalue3, opvalue4, opvalue5, urid }) {
  return callClubAPIUtility({
    mobile,
    bbpsId,
    customerMobile,
    opvalue1,
    opvalue2,
    opvalue3,
    opvalue4,
    opvalue5,
    urid: urid || generateClubUrid('KPB'),
    transType: 'billFetch'
  });
}

export async function payBbpsBill({ mobile, bbpsId, customerMobile, amount, opvalue1, opvalue2, opvalue3, opvalue4, opvalue5, urid }) {
  return callClubAPITransaction({
    mobile,
    bbpsId,
    customerMobile,
    amount: String(amount),
    opvalue1,
    opvalue2,
    opvalue3,
    opvalue4,
    opvalue5,
    urid: urid || generateClubUrid('KPY')
  });
}

export async function payout({ mobile, amount, outletMobile, bankAccountNumber, bankIfscCode, beneficiaryName, urid }) {
  const accountNumber = String(bankAccountNumber || mobile || '').trim();
  return callClubAPITransaction(cleanPayload({
    urid: urid || generateClubUrid('KPO'),
    operatorId: '735',
    mobile: String(mobile || accountNumber).trim(),
    amount: String(amount),
    outletMobile,
    bankAccountNumber: accountNumber,
    bankIfscCode: String(bankIfscCode || '').toUpperCase(),
    beneficiaryName
  }));
}
