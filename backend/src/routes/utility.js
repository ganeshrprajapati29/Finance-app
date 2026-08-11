import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import User from '../models/User.js';
import {
  getTransactionStatus,
  getBalance,
  getOperatorList,
  raiseDispute,
  getStateList,
  getOperatorPlans,
  getMobileDetails,
  validateBankAccount,
  validateRechargeAmount,
  validateUpiName,
  sendAadhaarOtp,
  verifyAadhaarOtp,
  verifyPan,
  registerOutlet,
  verifyOutletOtp,
  getOutletStatus,
  fetchBbpsBill,
  payBbpsBill,
  payout,
  callClubAPITransaction,
  callClubAPIUtility,
  generateClubUrid
} from '../services/clubapiUtility.js';

const router = Router();

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

router.post('/validate-upi', requireAuth, async (req, res, next) => {
  try {
    const { upiId } = await Joi.object({
      upiId: Joi.string().trim().lowercase().pattern(/^[a-z0-9.\-_]{2,}@[a-z0-9.\-_]{2,}$/i).required()
    }).validateAsync(req.body);

    const clubapi = await validateUpiName({ upiId });
    const user = await User.findOne({ upiId }).select('name mobile upiId bankName accountName status');
    const accountName = clubapi?.name ||
      clubapi?.accountName ||
      clubapi?.upiName ||
      clubapi?.beneName ||
      clubapi?.data?.name ||
      clubapi?.data?.accountName ||
      clubapi?.upiData?.name ||
      clubapi?.upiData?.accountName ||
      '';
    const resText = clubapi?.resText || clubapi?.message || '';
    ok(res, {
      upiId,
      isValid: true,
      source: user ? 'CLUBAPI_KHATUPAY' : 'CLUBAPI',
      accountName,
      resText,
      clubapi,
      account: user ? {
        name: user.accountName || user.name,
        mobile: user.mobile,
        upiId: user.upiId,
        bankName: user.bankName || 'UPI Linked Bank',
        status: user.status
      } : null
    });
  } catch (e) { next(e); }
});

// Transaction Status
router.post('/transaction-status', requireAuth, async (req, res, next) => {
  try {
    const { urid, orderId } = await Joi.object({
      urid: Joi.string().required(),
      orderId: Joi.string().required()
    }).validateAsync(req.body);

    const result = await getTransactionStatus({ urid, orderId });
    ok(res, result);
  } catch (e) { next(e); }
});

// Balance
router.get('/balance', requireAuth, async (req, res, next) => {
  try {
    const result = await getBalance();
    ok(res, result);
  } catch (e) { next(e); }
});

// Operator List
router.get('/operators', requireAuth, async (req, res, next) => {
  try {
    const result = await getOperatorList();
    ok(res, result);
  } catch (e) { next(e); }
});

// Dispute
router.post('/dispute', requireAuth, async (req, res, next) => {
  try {
    const { orderId } = await Joi.object({
      orderId: Joi.string().required()
    }).validateAsync(req.body);

    const result = await raiseDispute({ orderId });
    ok(res, result);
  } catch (e) { next(e); }
});

// State List
router.get('/states', requireAuth, async (req, res, next) => {
  try {
    const result = await getStateList();
    ok(res, result);
  } catch (e) { next(e); }
});

// Operator Plans (Mobile Plan Finder)
router.get('/operator-plans/:operatorId', requireAuth, async (req, res, next) => {
  try {
    const { operatorId } = req.params;
    const result = await getOperatorPlans({ operatorId });
    ok(res, result);
  } catch (e) { next(e); }
});

// Mobile Detail Finder
router.get('/mobile-details', requireAuth, async (req, res, next) => {
  try {
    const result = await getMobileDetails();
    ok(res, result);
  } catch (e) { next(e); }
});

// Bank Account Validation
router.post('/validate-bank-account', requireAuth, async (req, res, next) => {
  try {
    const { urid, customerMobile, accountNumber, ifscCode } = await Joi.object({
      urid: Joi.string().max(20).default(() => generateClubUrid('KBA')),
      customerMobile: Joi.string().pattern(/^\d{10}$/).required(),
      accountNumber: Joi.string().trim().min(6).max(30).required(),
      ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/i).required()
    }).validateAsync(req.body);

    const result = await validateBankAccount({ urid, customerMobile, accountNumber, ifscCode });
    ok(res, normalizeBankValidation(result, accountNumber, ifscCode));
  } catch (e) { next(e); }
});

router.post('/aadhaar/send-otp', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object({
      aadhaarNumber: Joi.string().pattern(/^\d{12}$/).required(),
      aadhaarMobile: Joi.string().pattern(/^\d{10}$/).allow('', null),
      urid: Joi.string().max(20).default(() => generateClubUrid('KPA'))
    }).validateAsync(req.body);

    ok(res, await sendAadhaarOtp(payload));
  } catch (e) { next(e); }
});

router.post('/aadhaar/verify-otp', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object({
      aadhaarNumber: Joi.string().pattern(/^\d{12}$/).required(),
      aadhaarMobile: Joi.string().pattern(/^\d{10}$/).allow('', null),
      otp: Joi.string().min(4).max(8).required(),
      otpSessionId: Joi.string().allow('', null),
      urid: Joi.string().max(20).allow('', null)
    }).validateAsync(req.body);

    ok(res, await verifyAadhaarOtp(payload));
  } catch (e) { next(e); }
});

router.post('/pan/verify', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object({
      pan: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/i).required(),
      urid: Joi.string().max(20).default(() => generateClubUrid('KPP'))
    }).validateAsync(req.body);

    ok(res, await verifyPan(payload));
  } catch (e) { next(e); }
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

router.post('/outlet/register', requireAuth, async (req, res, next) => {
  try {
    const payload = await outletRegisterSchema.validateAsync(req.body);
    payload.accountNumber = payload.accountNumber || payload.bankAccountNumber;
    payload.ifscCode = payload.ifscCode || payload.bankIfscCode;
    payload.address = payload.address || payload.shopAddress;
    ok(res, await registerOutlet(payload));
  } catch (e) { next(e); }
});

router.post('/outlet/verify-otp', requireAuth, async (req, res, next) => {
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
  } catch (e) { next(e); }
});

router.post('/outlet/status', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object({
      outletMobile: Joi.string().pattern(/^\d{10}$/).required(),
      mobile: Joi.string().pattern(/^\d{10}$/).allow('', null),
      urid: Joi.string().max(20).default(() => generateClubUrid('KOS')),
      transType: Joi.string().default('outletStatus')
    }).validateAsync(req.body);

    ok(res, await getOutletStatus(payload));
  } catch (e) { next(e); }
});

router.post('/bbps/fetch-bill', requireAuth, async (req, res, next) => {
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
  } catch (e) { next(e); }
});

router.post('/bbps/pay-bill', requireAuth, async (req, res, next) => {
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
  } catch (e) { next(e); }
});

router.post('/payout', requireAuth, async (req, res, next) => {
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
  } catch (e) { next(e); }
});

router.post('/clubapi/transaction', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object().unknown(true).validateAsync(req.body);
    delete payload.token;
    ok(res, await callClubAPITransaction(payload));
  } catch (e) { next(e); }
});

router.post('/clubapi/utility', requireAuth, async (req, res, next) => {
  try {
    const payload = await Joi.object().unknown(true).validateAsync(req.body);
    delete payload.token;
    ok(res, await callClubAPIUtility(payload));
  } catch (e) { next(e); }
});

// Recharge Amount Validation
router.post('/validate-recharge-amount', requireAuth, async (req, res, next) => {
  try {
    const { urid, mobile, operatorId, rechargeAmount, transType } = await Joi.object({
      urid: Joi.string().required(),
      mobile: Joi.string().required(),
      operatorId: Joi.string().required(),
      rechargeAmount: Joi.string().required(),
      transType: Joi.string().default('amountValidation')
    }).validateAsync(req.body);

    const normalizedTransType = ['mobile', 'dth'].includes(String(transType).toLowerCase())
      ? 'amountValidation'
      : transType;
    const result = await validateRechargeAmount({ urid, mobile, operatorId, rechargeAmount, transType: normalizedTransType });
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
