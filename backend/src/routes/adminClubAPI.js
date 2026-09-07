import express from 'express';
import Joi from 'joi';
import axios from 'axios';
import ClubAPITransaction from '../models/ClubAPITransaction.js';
import ClubAPIFundRequest from '../models/ClubAPIFundRequest.js';
import Settings from '../models/Settings.js';
import AuditLog from '../models/AuditLog.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';
import clubapiConfig from '../config/clubapi.js';
import {
  getBalance,
  validateBankAccount,
  validateRechargeAmount,
  validateUpiName,
  sendAadhaarOtp,
  verifyAadhaarOtp,
  verifyPan,
  fetchBbpsBill,
  payBbpsBill,
  registerOutlet,
  verifyOutletOtp,
  getOutletStatus,
  payout,
  callClubAPITransaction,
  generateClubUrid
} from '../services/clubapiUtility.js';

const router = express.Router();

const defaultClubapiSettings = {
  enabled: true,
  baseUrl: 'https://api.clubapi.in',
  callbackUrl: 'https://khatupay.com/api/callback/clubapi',
  callbackId: '',
  timeout: 30000,
  retryAttempts: 3,
  billFetchEnabled: true,
  billPaymentEnabled: true,
  mobileRechargeEnabled: true,
  dthRechargeEnabled: true
};

const providerBankOptions = [
  {
    label: 'P2P Wallet - ICICI 1145',
    accountNumber: '114505002084',
    ifsc: 'ICIC0001145',
    accountName: 'RECHAPI PRIVATE LIMITED',
    walletType: 'P2P',
    minimumAmount: 1000
  }
];

async function getSettingsDocument() {
  let settings = await Settings.findOne();
  if (!settings) settings = new Settings();
  settings.clubapi = { ...defaultClubapiSettings, ...(settings.clubapi?.toObject?.() || settings.clubapi || {}) };
  return settings;
}

function presentClubapiSettings(settings) {
  return {
    ...defaultClubapiSettings,
    ...(settings.clubapi?.toObject?.() || settings.clubapi || {}),
    tokenConfigured: Boolean(clubapiConfig.token)
  };
}

function pickFirstNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const number = Number(String(value).replace(/,/g, ''));
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function normalizeBalanceResponse(data = {}) {
  const nested = data.data && typeof data.data === 'object' ? data.data : {};
  const balanceObject = data.balance && typeof data.balance === 'object' ? data.balance : {};
  const buyerBalance = balanceObject.buyer && typeof balanceObject.buyer === 'object' ? balanceObject.buyer : {};
  const sellerBalance = balanceObject.seller && typeof balanceObject.seller === 'object' ? balanceObject.seller : {};
  const balance = pickFirstNumber(
    data.balance,
    data.bal,
    data.buyerP2PBal,
    data.points,
    data.walletBalance,
    data.availableBalance,
    data.mainBalance,
    nested.balance,
    nested.bal,
    nested.buyerP2PBal,
    nested.points,
    nested.walletBalance,
    nested.availableBalance,
    nested.mainBalance,
    buyerBalance.buyer_total,
    buyerBalance.buyer_p2p,
    buyerBalance.buyer_p2a,
    sellerBalance.seller_total
  );
  const status = String(data.status || nested.status || '').toUpperCase();
  const message = data.message || data.resText || nested.message || nested.resText || '';

  return {
    status: status || (balance !== null ? 'SUCCESS' : ''),
    message,
    balance,
    balanceText: balance !== null ? `Rs. ${balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : 'N/A',
    buyer: {
      p2p: pickFirstNumber(buyerBalance.buyer_p2p),
      p2a: pickFirstNumber(buyerBalance.buyer_p2a),
      total: pickFirstNumber(buyerBalance.buyer_total)
    },
    seller: {
      p2p: pickFirstNumber(sellerBalance.seller_p2p),
      p2a: pickFirstNumber(sellerBalance.seller_p2a),
      total: pickFirstNumber(sellerBalance.seller_total)
    },
    points: pickFirstNumber(data.points, nested.points),
    tokenConfigured: Boolean(clubapiConfig.token),
    callbackIdConfigured: Boolean(clubapiConfig.callbackId),
    checkedAt: new Date().toISOString(),
    raw: data
  };
}

function normalizeProviderText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (typeof value === 'object') {
    return value.message || value.msg || value.resText || value.error || JSON.stringify(value);
  }
  return String(value);
}

function normalizeFundProviderResponse(data = {}) {
  const text = normalizeProviderText(data);
  const statusValue = String(data?.status || data?.data?.status || '').toUpperCase();
  const failed = /invalid|failed|error|login|session|unauthor/i.test(`${statusValue} ${text}`);
  const success = /success|submitted|request/i.test(`${statusValue} ${text}`) && !failed;
  return {
    ok: success,
    status: success ? 'SUBMITTED' : 'FAILED',
    message: text || (success ? 'Fund request submitted to provider' : 'Provider fund request failed'),
    raw: data
  };
}

function normalizeProviderFundRow(row, index) {
  if (Array.isArray(row)) {
    return {
      id: row[0] || index + 1,
      date: row[0] || row[1] || '',
      accountNumber: row[1] || row[2] || '',
      amount: row[2] || row[3] || '',
      transactionDate: row[3] || row[4] || '',
      method: row[4] || row[5] || '',
      refNumber: row[5] || row[6] || '',
      status: row[6] || row[7] || '',
      walletType: row[7] || row[8] || '',
      updateTime: row[8] || row[9] || '',
      remark: row[9] || row[10] || '',
      raw: row
    };
  }
  const source = row && typeof row === 'object' ? row : {};
  return {
    id: source.id || source.ID || source.sr || source._id || index + 1,
    date: source.date || source.DATE || source.createdAt || source.created_at || source.requestDate || '',
    accountNumber: source.accountNumber || source.account_number || source.ACCOUNT_NUMBER || source.bank || source.account || '',
    amount: source.amount || source.AMOUNT || '',
    transactionDate: source.transactionDate || source.transDate || source.TRANSDATE || source.transaction_date || '',
    method: source.method || source.METHOD || source.paymentMode || '',
    refNumber: source.refNumber || source.REFNUMBER || source.bankRefNumber || source.utrNumber || source.utr || '',
    status: source.status || source.STATUS || '',
    walletType: source.walletType || source.WALLETTYPE || source.wallet_type || '',
    updateTime: source.updateTime || source.UPDATETIME || source.updatedAt || source.updated_at || '',
    remark: source.remark || source.REMARK || source.message || '',
    raw: row
  };
}

function normalizeProviderFundList(data) {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.aaData)
        ? data.aaData
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.rows)
            ? data.rows
            : [];

  return {
    items: rows.map(normalizeProviderFundRow),
    total: Number(data?.recordsTotal || data?.recordsFiltered || data?.total || rows.length || 0),
    message: normalizeProviderText(data) || 'Provider fund requests fetched',
    raw: data
  };
}

async function fetchFundRequestsFromProvider(query = {}) {
  const params = new URLSearchParams();
  if (query.start) params.set('start', String(query.start));
  if (query.length) params.set('length', String(query.length));
  if (query.search) params.set('search[value]', String(query.search));

  const headers = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: 'https://clubapi.in/account/buyer_fund_request.php'
  };
  if (clubapiConfig.fundRequestCookie) headers.Cookie = clubapiConfig.fundRequestCookie;

  const response = await axios.post(clubapiConfig.fundRequestListURL, params.toString(), {
    headers,
    timeout: Number(process.env.CLUBAPI_FUND_REQUEST_TIMEOUT || 30000),
    responseType: 'text',
    transformResponse: [(data) => {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }]
  });

  const text = normalizeProviderText(response.data);
  if (typeof response.data === 'string' && /login|password|sign in|logout/i.test(text) && !/fund|amount|wallet/i.test(text)) {
    throw new Error('ClubAPI panel session expire/missing hai. Fresh panel cookie set karein.');
  }

  return normalizeProviderFundList(response.data);
}

async function submitFundRequestToProvider(payload) {
  const params = new URLSearchParams({
    amount: String(payload.amount),
    bankRefNumber: payload.utrNumber,
    transactionDate: payload.paymentDate,
    bank: payload.bankAccountNumber,
    method: String(payload.paymentMode || '').toLowerCase(),
    walletType: payload.walletType
  });

  const headers = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: 'https://clubapi.in/account/buyer_fund_request.php'
  };
  if (clubapiConfig.fundRequestCookie) headers.Cookie = clubapiConfig.fundRequestCookie;

  const response = await axios.post(clubapiConfig.fundRequestURL, params.toString(), {
    headers,
    timeout: Number(process.env.CLUBAPI_FUND_REQUEST_TIMEOUT || 30000),
    responseType: 'text',
    transformResponse: [(data) => {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }]
  });

  return normalizeFundProviderResponse(response.data);
}

router.get('/balance', requireAdmin, async (req, res) => {
  try {
    const settings = await getSettingsDocument();
    const balance = await getBalance();
    ok(res, {
      ...normalizeBalanceResponse(balance),
      settings: presentClubapiSettings(settings),
      fundRequest: {
        providerConfigured: Boolean(clubapiConfig.fundRequestURL),
        sessionConfigured: Boolean(clubapiConfig.fundRequestCookie),
        banks: providerBankOptions
      }
    }, 'ClubAPI balance fetched');
  } catch (error) {
    fail(res, 'CLUBAPI_BALANCE_FAILED', error.message || 'ClubAPI balance fetch failed', 400);
  }
});

const fundRequestSchema = Joi.object({
  amount: Joi.number().min(1).required(),
  paymentMode: Joi.string().valid('UPI', 'IMPS', 'NEFT', 'RTGS', 'BANK_TRANSFER', 'CASH_DEPOSIT', 'OTHER').default('IMPS'),
  utrNumber: Joi.string().trim().min(8).max(80).required(),
  paymentDate: Joi.date().default(() => new Date()),
  bankAccountNumber: Joi.string().trim().min(6).max(30).default(providerBankOptions[0].accountNumber),
  walletType: Joi.string().valid('P2P', 'P2A').default('P2P'),
  proofUrl: Joi.string().trim().allow('', null).max(500),
  remarks: Joi.string().trim().allow('', null).max(1000),
  status: Joi.string().valid('DRAFT', 'SUBMITTED', 'PENDING').default('SUBMITTED')
});

router.get('/fund-requests', requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = '',
      search = '',
      startDate,
      endDate
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      const safe = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      query.$or = [{ utrNumber: regex }, { providerReference: regex }, { remarks: regex }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total, stats] = await Promise.all([
      ClubAPIFundRequest.find(query)
        .populate('requestedBy', 'name email mobile')
        .populate('reviewedBy', 'name email mobile')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ClubAPIFundRequest.countDocuments(query),
      ClubAPIFundRequest.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$amount' }
          }
        }
      ])
    ]);

    ok(res, {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)) || 1,
      stats
    });
  } catch (error) {
    fail(res, 'FUND_REQUESTS_FAILED', error.message || 'Fund requests load failed', 500);
  }
});

router.post('/fund-requests', requireAdmin, async (req, res) => {
  try {
    const payload = await fundRequestSchema.validateAsync(req.body);
    const bankOption = providerBankOptions.find((bank) => bank.accountNumber === payload.bankAccountNumber);
    const minimumAmount = bankOption?.minimumAmount || 1;
    if (Number(payload.amount) < minimumAmount) {
      return fail(res, 'FUND_REQUEST_MIN_AMOUNT', `Minimum fund request amount Rs. ${minimumAmount} hai`, 400);
    }

    let balanceBefore = {};
    try {
      balanceBefore = normalizeBalanceResponse(await getBalance());
    } catch (error) {
      balanceBefore = { status: 'FAILED', message: error.message };
    }

    let provider = null;
    try {
      provider = await submitFundRequestToProvider({
        ...payload,
        paymentDate: new Date(payload.paymentDate).toISOString().slice(0, 10)
      });
    } catch (error) {
      const providerMessage = error.response?.data || error.message || 'Provider fund request submit failed';
      provider = {
        ok: false,
        status: 'FAILED',
        message: normalizeProviderText(providerMessage),
        raw: error.response?.data || { message: error.message, status: error.response?.status }
      };
    }

    if (!provider.ok) {
      return fail(res, 'FUND_REQUEST_PROVIDER_FAILED', provider.message || 'Provider ne fund request accept nahi kiya', 400);
    }

    const request = await ClubAPIFundRequest.create({
      ...payload,
      status: provider.status,
      providerSubmitted: true,
      providerReference: provider.raw?.id || provider.raw?.requestId || provider.raw?.reference || '',
      providerResponse: provider.raw,
      proofUrl: payload.proofUrl || '',
      remarks: payload.remarks || '',
      balanceBefore,
      requestedBy: req.admin.id
    });

    await AuditLog.create({
      actorId: req.admin.id,
      action: 'CREATE_CLUBAPI_FUND_REQUEST',
      entityType: 'ClubAPIFundRequest',
      entityId: request._id.toString(),
      meta: {
        amount: request.amount,
        paymentMode: request.paymentMode,
        utrNumber: request.utrNumber,
        bankAccountNumber: request.bankAccountNumber,
        walletType: request.walletType,
        status: request.status
      }
    });

    ok(res, request, provider.message || 'Fund request submitted successfully');
  } catch (error) {
    fail(res, 'FUND_REQUEST_CREATE_FAILED', error.message || 'Fund request save failed', 400);
  }
});

router.get('/fund-requests/provider', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      search: Joi.string().trim().allow('', null).default('')
    }).validateAsync(req.query);
    const data = await fetchFundRequestsFromProvider({
      start: (payload.page - 1) * payload.limit,
      length: payload.limit,
      search: payload.search
    });
    ok(res, {
      ...data,
      page: payload.page,
      limit: payload.limit,
      sessionConfigured: Boolean(clubapiConfig.fundRequestCookie)
    });
  } catch (error) {
    fail(res, 'FUND_REQUEST_PROVIDER_LIST_FAILED', error.message || 'Provider fund request list load nahi ho payi', 400);
  }
});

router.get('/fund-requests/:id', requireAdmin, async (req, res) => {
  try {
    const request = await ClubAPIFundRequest.findById(req.params.id)
      .populate('requestedBy', 'name email mobile')
      .populate('reviewedBy', 'name email mobile');
    if (!request) return fail(res, 'NOT_FOUND', 'Fund request not found', 404);
    ok(res, request);
  } catch (error) {
    fail(res, 'FUND_REQUEST_DETAIL_FAILED', error.message || 'Fund request detail failed', 500);
  }
});

router.put('/fund-requests/:id/status', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      status: Joi.string().valid('DRAFT', 'SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'FAILED').required(),
      reviewedNote: Joi.string().trim().allow('', null).max(1000),
      providerReference: Joi.string().trim().allow('', null).max(120),
      providerResponse: Joi.object().default({})
    }).validateAsync(req.body);

    const request = await ClubAPIFundRequest.findById(req.params.id);
    if (!request) return fail(res, 'NOT_FOUND', 'Fund request not found', 404);

    request.status = payload.status;
    request.reviewedNote = payload.reviewedNote || '';
    request.providerReference = payload.providerReference || request.providerReference || '';
    request.providerResponse = payload.providerResponse || {};
    request.reviewedBy = req.admin.id;
    request.reviewedAt = new Date();

    if (payload.status === 'APPROVED' || payload.status === 'REJECTED' || payload.status === 'FAILED') {
      try {
        request.balanceAfter = normalizeBalanceResponse(await getBalance());
      } catch (error) {
        request.balanceAfter = { status: 'FAILED', message: error.message };
      }
    }

    await request.save();
    await AuditLog.create({
      actorId: req.admin.id,
      action: 'UPDATE_CLUBAPI_FUND_REQUEST',
      entityType: 'ClubAPIFundRequest',
      entityId: request._id.toString(),
      meta: {
        status: request.status,
        providerReference: request.providerReference,
        reviewedNote: request.reviewedNote
      }
    });

    ok(res, request, 'Fund request status updated');
  } catch (error) {
    fail(res, 'FUND_REQUEST_STATUS_FAILED', error.message || 'Fund request update failed', 400);
  }
});

router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await getSettingsDocument();
    ok(res, presentClubapiSettings(settings));
  } catch (error) {
    fail(res, 'CLUBAPI_SETTINGS_FAILED', error.message || 'ClubAPI settings load failed', 500);
  }
});

router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      enabled: Joi.boolean().optional(),
      baseUrl: Joi.string().uri().optional(),
      callbackUrl: Joi.string().uri({ scheme: ['https'] }).required(),
      callbackId: Joi.string().trim().allow('', null).max(80),
      timeout: Joi.number().integer().min(5000).max(120000).optional(),
      retryAttempts: Joi.number().integer().min(0).max(5).optional(),
      billFetchEnabled: Joi.boolean().optional(),
      billPaymentEnabled: Joi.boolean().optional(),
      mobileRechargeEnabled: Joi.boolean().optional(),
      dthRechargeEnabled: Joi.boolean().optional()
    }).validateAsync(req.body);

    const settings = await getSettingsDocument();
    settings.clubapi = {
      ...defaultClubapiSettings,
      ...(settings.clubapi?.toObject?.() || settings.clubapi || {}),
      ...payload,
      callbackId: payload.callbackId || ''
    };
    await settings.save();
    ok(res, presentClubapiSettings(settings), 'ClubAPI settings saved');
  } catch (error) {
    fail(res, 'CLUBAPI_SETTINGS_SAVE_FAILED', error.message || 'ClubAPI settings save failed', 400);
  }
});

router.post('/settings/test', requireAdmin, async (req, res) => {
  try {
    const settings = await getSettingsDocument();
    const balance = await getBalance();
    let callbackStatus = null;
    try {
      const callbackRes = await axios.get(settings.clubapi.callbackUrl, { timeout: 8000 });
      callbackStatus = callbackRes.status;
    } catch (error) {
      callbackStatus = error.response?.status || 0;
    }

    ok(res, {
      balanceStatus: balance?.status || '',
      callbackStatus,
      callbackUrl: settings.clubapi.callbackUrl,
      callbackIdConfigured: Boolean(settings.clubapi.callbackId),
      tokenConfigured: Boolean(clubapiConfig.token)
    }, 'ClubAPI test complete');
  } catch (error) {
    fail(res, 'CLUBAPI_TEST_FAILED', error.message || 'ClubAPI test failed', 400);
  }
});

function normalizeBankValidation(data = {}, accountNumber, ifscCode) {
  const nested = data.data && typeof data.data === 'object' ? data.data : {};
  const accountName = data.beneficiaryName ||
    data.accountName ||
    data.name ||
    nested.beneficiaryName ||
    nested.accountName ||
    nested.name ||
    '';
  const resText = data.resText || data.message || nested.resText || nested.message || '';
  return {
    accountNumber,
    ifscCode: String(ifscCode || '').toUpperCase(),
    operatorId: '233',
    isValid: Boolean(accountName) || /success|valid|verified/i.test(`${data.status || ''} ${resText}`),
    accountName,
    beneficiaryName: accountName,
    resText,
    clubapi: data
  };
}

function normalizePayoutResponse(data = {}, payload = {}) {
  const nested = data.data && typeof data.data === 'object' ? data.data : {};
  const status = String(data.status || nested.status || '').toUpperCase();
  const resText = data.resText || data.message || nested.resText || nested.message || '';
  return {
    urid: data.urid || nested.urid || payload.urid,
    orderId: data.orderId || data.order_id || nested.orderId || nested.order_id || '',
    status: status || (resText ? 'PENDING' : ''),
    isSuccess: /success|completed/i.test(`${status} ${resText}`),
    amount: payload.amount,
    outletMobile: payload.outletMobile,
    beneficiaryName: payload.beneficiaryName,
    bankAccountNumber: payload.bankAccountNumber,
    bankIfscCode: String(payload.bankIfscCode || '').toUpperCase(),
    resText,
    clubapi: data
  };
}

router.post('/bank/validate', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      customerMobile: Joi.string().pattern(/^\d{10}$/).required(),
      accountNumber: Joi.string().trim().min(6).max(30).required(),
      ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/i).required(),
      urid: Joi.string().max(20).default(() => generateClubUrid('KBA'))
    }).validateAsync(req.body);

    const result = await validateBankAccount(payload);
    ok(res, normalizeBankValidation(result, payload.accountNumber, payload.ifscCode));
  } catch (error) {
    fail(res, 'BANK_VALIDATE_FAILED', error.message || 'Bank account validation failed', 400);
  }
});

router.post('/payout', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      mobile: Joi.string().allow('', null),
      amount: Joi.alternatives().try(Joi.number().positive(), Joi.string().required()).required(),
      outletMobile: Joi.string().pattern(/^\d{10}$/).required(),
      bankAccountNumber: Joi.string().trim().min(6).max(30).required(),
      bankIfscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/i).required(),
      beneficiaryName: Joi.string().trim().min(2).max(120).required(),
      urid: Joi.string().max(20).default(() => generateClubUrid('KPO'))
    }).validateAsync(req.body);

    payload.mobile = payload.mobile || payload.bankAccountNumber;
    const result = await payout(payload);
    ok(res, normalizePayoutResponse(result, payload));
  } catch (error) {
    fail(res, 'PAYOUT_FAILED', error.message || 'Payout failed', 400);
  }
});

router.post('/upi/validate', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      upiId: Joi.string().trim().lowercase().pattern(/^[a-z0-9.\-_]{2,}@[a-z0-9.\-_]{2,}$/i).required(),
      urid: Joi.string().max(20).default(() => generateClubUrid('KPU'))
    }).validateAsync(req.body);

    ok(res, await validateUpiName(payload));
  } catch (error) {
    fail(res, 'UPI_VALIDATE_FAILED', error.message || 'UPI validation failed', 400);
  }
});

router.post('/aadhaar/send-otp', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      aadhaarNumber: Joi.string().pattern(/^\d{12}$/).required(),
      aadhaarMobile: Joi.string().pattern(/^\d{10}$/).allow('', null),
      urid: Joi.string().max(20).default(() => generateClubUrid('KPA'))
    }).validateAsync(req.body);

    ok(res, await sendAadhaarOtp(payload));
  } catch (error) {
    fail(res, 'AADHAAR_OTP_FAILED', error.message || 'Aadhaar OTP request failed', 400);
  }
});

router.post('/aadhaar/verify-otp', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      aadhaarNumber: Joi.string().pattern(/^\d{12}$/).required(),
      aadhaarMobile: Joi.string().pattern(/^\d{10}$/).allow('', null),
      otp: Joi.string().min(4).max(8).required(),
      otpSessionId: Joi.string().allow('', null),
      urid: Joi.string().max(20).allow('', null)
    }).validateAsync(req.body);

    ok(res, await verifyAadhaarOtp(payload));
  } catch (error) {
    fail(res, 'AADHAAR_VERIFY_FAILED', error.message || 'Aadhaar OTP verification failed', 400);
  }
});

router.post('/pan/verify', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      pan: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/i).required(),
      urid: Joi.string().max(20).default(() => generateClubUrid('KPP'))
    }).validateAsync(req.body);

    ok(res, await verifyPan(payload));
  } catch (error) {
    fail(res, 'PAN_VERIFY_FAILED', error.message || 'PAN verification failed', 400);
  }
});

router.post('/bbps/fetch-bill', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      mobile: Joi.string().required(),
      bbpsId: Joi.string().required(),
      customerMobile: Joi.string().pattern(/^\d{10}$/).required(),
      opvalue1: Joi.string().allow('', null),
      opvalue2: Joi.string().allow('', null),
      opvalue3: Joi.string().allow('', null),
      opvalue4: Joi.string().allow('', null),
      opvalue5: Joi.string().allow('', null),
      urid: Joi.string().max(20).default(() => generateClubUrid('KPB'))
    }).validateAsync(req.body);

    ok(res, await fetchBbpsBill(payload));
  } catch (error) {
    fail(res, 'BBPS_FETCH_FAILED', error.message || 'BBPS bill fetch failed', 400);
  }
});

router.post('/bbps/pay-bill', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      mobile: Joi.string().required(),
      bbpsId: Joi.string().required(),
      customerMobile: Joi.string().pattern(/^\d{10}$/).required(),
      amount: Joi.alternatives().try(Joi.number().positive(), Joi.string().required()).required(),
      opvalue1: Joi.string().allow('', null),
      opvalue2: Joi.string().allow('', null),
      opvalue3: Joi.string().allow('', null),
      opvalue4: Joi.string().allow('', null),
      opvalue5: Joi.string().allow('', null),
      urid: Joi.string().max(20).default(() => generateClubUrid('KPY'))
    }).validateAsync(req.body);

    ok(res, await payBbpsBill(payload));
  } catch (error) {
    fail(res, 'BBPS_PAY_FAILED', error.message || 'BBPS bill payment failed', 400);
  }
});

router.post('/recharge/validate-amount', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      mobile: Joi.string().required(),
      operatorId: Joi.string().required(),
      rechargeAmount: Joi.string().required(),
      urid: Joi.string().max(20).default(() => generateClubUrid('KRV')),
      transType: Joi.string().default('amountValidation')
    }).validateAsync(req.body);

    ok(res, await validateRechargeAmount(payload));
  } catch (error) {
    fail(res, 'RECHARGE_VALIDATE_FAILED', error.message || 'Recharge amount validation failed', 400);
  }
});

router.post('/recharge', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      mobile: Joi.string().required(),
      operatorId: Joi.string().required(),
      amount: Joi.alternatives().try(Joi.number().positive(), Joi.string().required()).required(),
      customerMobile: Joi.string().pattern(/^\d{10}$/).allow('', null),
      cbId: Joi.string().allow('', null),
      opvalue1: Joi.string().allow('', null),
      opvalue2: Joi.string().allow('', null),
      opvalue3: Joi.string().allow('', null),
      opvalue4: Joi.string().allow('', null),
      opvalue5: Joi.string().allow('', null),
      urid: Joi.string().max(20).default(() => generateClubUrid('KPR'))
    }).validateAsync(req.body);

    ok(res, await callClubAPITransaction(payload));
  } catch (error) {
    fail(res, 'RECHARGE_FAILED', error.message || 'Recharge failed', 400);
  }
});

const outletRegisterSchema = Joi.object({
  outletMobile: Joi.string().pattern(/^\d{10}$/).required(),
  mobile: Joi.string().pattern(/^\d{10}$/).allow('', null),
  aadhaarNumber: Joi.string().pattern(/^\d{12}$/).required(),
  pan: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/i).required(),
  name: Joi.string().trim().min(2).max(100).required(),
  shopName: Joi.string().trim().min(2).max(150).required(),
  shopAddress: Joi.string().trim().min(5).max(250).required(),
  address: Joi.string().trim().min(5).max(250).allow('', null),
  pincode: Joi.string().pattern(/^\d{6}$/).required(),
  state: Joi.string().trim().min(2).max(80).required(),
  city: Joi.string().trim().min(2).max(80).required(),
  bankAccountNumber: Joi.string().trim().min(6).max(30).required(),
  bankIfscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/i).required(),
  accountNumber: Joi.string().trim().min(6).max(30).allow('', null),
  ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/i).allow('', null),
  latitude: Joi.alternatives().try(Joi.number(), Joi.string().trim()).required(),
  longitude: Joi.alternatives().try(Joi.number(), Joi.string().trim()).required(),
  email: Joi.string().email().allow('', null),
  urid: Joi.string().max(20).default(() => generateClubUrid('KOR')),
  transType: Joi.string().default('outletRegister')
}).unknown(true);

router.post('/outlet/register', requireAdmin, async (req, res) => {
  try {
    const payload = await outletRegisterSchema.validateAsync(req.body);
    payload.accountNumber = payload.accountNumber || payload.bankAccountNumber;
    payload.ifscCode = payload.ifscCode || payload.bankIfscCode;
    payload.address = payload.address || payload.shopAddress;
    ok(res, await registerOutlet(payload));
  } catch (error) {
    fail(res, 'OUTLET_REGISTER_FAILED', error.message || 'Outlet registration OTP failed', 400);
  }
});

router.post('/outlet/verify-otp', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      outletMobile: Joi.string().pattern(/^\d{10}$/).required(),
      mobile: Joi.string().pattern(/^\d{10}$/).allow('', null),
      aadhaarNumber: Joi.string().pattern(/^\d{12}$/).allow('', null),
      otp: Joi.string().min(4).max(8).required(),
      otpSessionId: Joi.string().allow('', null),
      latitude: Joi.alternatives().try(Joi.number(), Joi.string().trim()).allow('', null),
      longitude: Joi.alternatives().try(Joi.number(), Joi.string().trim()).allow('', null),
      urid: Joi.string().max(20).default(() => generateClubUrid('KOV')),
      transType: Joi.string().default('outletRegisterVerify')
    }).unknown(true).validateAsync(req.body);

    ok(res, await verifyOutletOtp(payload));
  } catch (error) {
    fail(res, 'OUTLET_VERIFY_FAILED', error.message || 'Outlet OTP verification failed', 400);
  }
});

router.post('/outlet/status', requireAdmin, async (req, res) => {
  try {
    const payload = await Joi.object({
      outletMobile: Joi.string().pattern(/^\d{10}$/).required(),
      mobile: Joi.string().pattern(/^\d{10}$/).allow('', null),
      urid: Joi.string().max(20).default(() => generateClubUrid('KOS')),
      transType: Joi.string().default('outletStatus')
    }).validateAsync(req.body);

    ok(res, await getOutletStatus(payload));
  } catch (error) {
    fail(res, 'OUTLET_STATUS_FAILED', error.message || 'Outlet status check failed', 400);
  }
});

// Get all ClubAPI transactions with pagination and filters
router.get('/transactions', requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      userId,
      startDate,
      endDate,
      search
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (userId) query.userId = userId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { urid: { $regex: search, $options: 'i' } },
        { accountRef: { $regex: search, $options: 'i' } },
        { customerMobile: { $regex: search, $options: 'i' } }
      ];
    }

    const transactions = await ClubAPITransaction.find(query)
      .populate('userId', 'name email mobile')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ClubAPITransaction.countDocuments(query);

    ok(res, {
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalTransactions: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Admin ClubAPI transactions error:', error);
    fail(res, 'FETCH_FAILED', 'Failed to fetch transactions', 500);
  }
});

// Get transaction details by ID
router.get('/transactions/:id', requireAdmin, async (req, res) => {
  try {
    const transaction = await ClubAPITransaction.findById(req.params.id)
      .populate('userId', 'name email mobile');

    if (!transaction) {
      return fail(res, 'NOT_FOUND', 'Transaction not found', 404);
    }

    ok(res, transaction);
  } catch (error) {
    console.error('Admin ClubAPI transaction detail error:', error);
    fail(res, 'FETCH_FAILED', 'Failed to fetch transaction details', 500);
  }
});

// Update transaction status
router.put('/transactions/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(status)) {
      return fail(res, 'INVALID_STATUS', 'Invalid status value', 400);
    }

    const transaction = await ClubAPITransaction.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(notes && { notes }),
        updatedAt: new Date()
      },
      { new: true }
    ).populate('userId', 'name email mobile');

    if (!transaction) {
      return fail(res, 'NOT_FOUND', 'Transaction not found', 404);
    }

    ok(res, transaction);
  } catch (error) {
    console.error('Admin ClubAPI status update error:', error);
    fail(res, 'UPDATE_FAILED', 'Failed to update transaction status', 500);
  }
});

// Get transaction statistics
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const stats = await ClubAPITransaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          completedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          pendingTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          }
        }
      }
    ]);

    const typeStats = await ClubAPITransaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    ok(res, {
      overview: stats[0] || {
        totalTransactions: 0,
        totalAmount: 0,
        completedTransactions: 0,
        failedTransactions: 0,
        pendingTransactions: 0
      },
      byType: typeStats,
      successRate: stats[0]?.totalTransactions ? Math.round(((stats[0]?.completedTransactions || 0) / stats[0].totalTransactions) * 100) : 0
    });
  } catch (error) {
    console.error('Admin ClubAPI stats error:', error);
    fail(res, 'STATS_FAILED', 'Failed to fetch statistics', 500);
  }
});

// Get recent transactions for dashboard
router.get('/recent', requireAdmin, async (req, res) => {
  try {
    const transactions = await ClubAPITransaction.find()
      .populate('userId', 'name email mobile')
      .sort({ createdAt: -1 })
      .limit(10);

    ok(res, transactions);
  } catch (error) {
    console.error('Admin ClubAPI recent transactions error:', error);
    fail(res, 'FETCH_FAILED', 'Failed to fetch recent transactions', 500);
  }
});

export default router;
