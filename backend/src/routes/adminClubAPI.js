import express from 'express';
import Joi from 'joi';
import axios from 'axios';
import ClubAPITransaction from '../models/ClubAPITransaction.js';
import Settings from '../models/Settings.js';
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
