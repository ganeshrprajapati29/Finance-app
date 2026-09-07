import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { ok } from '../utils/response.js';
import { callConsumer, consumerSetupStatus, notConfiguredPayload } from '../services/juspayConsumer.js';

const router = Router();

function userCustomerId(req) {
  return `khatu.${String(req.user.uid).replace(/[^a-zA-Z0-9.]/g, '')}`.slice(0, 256);
}

function handleConsumer(action, schema, mapBody = (body) => body) {
  return async (req, res, next) => {
    try {
      const body = await schema.validateAsync(req.body || {});
      const payload = {
        merchantCustomerId: userCustomerId(req),
        ...mapBody(body, req),
      };
      const result = await callConsumer(action, payload);
      ok(res, result, 'Juspay Consumer request completed');
    } catch (error) {
      if (String(error.code || '').startsWith('JUSPAY_CONSUMER')) {
        return res.status(error.status || 503).json({
          success: false,
          ...notConfiguredPayload(error),
        });
      }
      next(error);
    }
  };
}

router.get('/setup', requireAuth, (req, res) => {
  ok(res, consumerSetupStatus(), 'Juspay Consumer setup status');
});

router.post('/sms-token', requireAuth, handleConsumer('getSmsToken', Joi.object({
  mobile: Joi.string().pattern(/^\d{10,12}$/).required(),
  deviceFingerPrint: Joi.string().allow('', null),
})));

router.post('/bind-device', requireAuth, handleConsumer('bindDevice', Joi.object({
  mobile: Joi.string().pattern(/^\d{10,12}$/).required(),
  smsToken: Joi.string().required(),
  deviceFingerPrint: Joi.string().required(),
})));

router.post('/banks', requireAuth, handleConsumer('listBanks', Joi.object({
  query: Joi.string().allow('', null),
})));

router.post('/accounts/fetch', requireAuth, handleConsumer('fetchAccounts', Joi.object({
  mobile: Joi.string().pattern(/^\d{10,12}$/).required(),
  bankCode: Joi.string().allow('', null),
  deviceFingerPrint: Joi.string().required(),
})));

router.post('/balance', requireAuth, handleConsumer('checkBalance', Joi.object({
  bankAccountUniqueId: Joi.string().required(),
  payerVpa: Joi.string().required(),
  credBlock: Joi.string().required(),
  deviceFingerPrint: Joi.string().required(),
})));

router.post('/vpa/verify', requireAuth, handleConsumer('verifyVpa', Joi.object({
  vpa: Joi.string().required(),
})));

router.post('/mpin/set', requireAuth, handleConsumer('setMpin', Joi.object({
  bankAccountUniqueId: Joi.string().required(),
  payerVpa: Joi.string().required(),
  credBlock: Joi.string().required(),
  deviceFingerPrint: Joi.string().required(),
})));

router.post('/mpin/change', requireAuth, handleConsumer('changeMpin', Joi.object({
  bankAccountUniqueId: Joi.string().required(),
  payerVpa: Joi.string().required(),
  credBlock: Joi.string().required(),
  deviceFingerPrint: Joi.string().required(),
})));

router.post('/mpin/reset', requireAuth, handleConsumer('resetMpin', Joi.object({
  bankAccountUniqueId: Joi.string().required(),
  payerVpa: Joi.string().required(),
  credBlock: Joi.string().required(),
  deviceFingerPrint: Joi.string().required(),
})));

router.post('/send-money', requireAuth, handleConsumer('sendMoney', Joi.object({
  bankAccountUniqueId: Joi.string().required(),
  payerVpa: Joi.string().required(),
  payeeVpa: Joi.string().required(),
  payeeName: Joi.string().required(),
  amount: Joi.number().min(1).max(100000).required(),
  remarks: Joi.string().max(50).default('Khatu Pay'),
  transactionType: Joi.string().valid('P2P_PAY', 'P2M_PAY', 'SELF_PAY', 'INTENT_PAY', 'SCAN_PAY').default('P2P_PAY'),
  credBlock: Joi.string().required(),
  deviceFingerPrint: Joi.string().required(),
}), (body) => ({
  ...body,
  amount: Number(body.amount).toFixed(2),
  currency: 'INR',
  purpose: '00',
})));

router.post('/request-money', requireAuth, handleConsumer('requestMoney', Joi.object({
  payerVpa: Joi.string().required(),
  payeeVpa: Joi.string().required(),
  amount: Joi.number().min(1).max(100000).required(),
  remarks: Joi.string().max(50).default('Khatu Pay collect'),
}), (body) => ({ ...body, amount: Number(body.amount).toFixed(2), currency: 'INR' })));

router.post('/transactions/status', requireAuth, handleConsumer('transactionStatus', Joi.object({
  merchantRequestId: Joi.string().required(),
  transactionType: Joi.string().allow('', null).default('P2P_PAY'),
})));

router.post('/transactions/list', requireAuth, handleConsumer('listTransactions', Joi.object({
  fromDate: Joi.string().allow('', null),
  toDate: Joi.string().allow('', null),
  limit: Joi.number().integer().min(1).max(100).default(25),
})));

router.post('/upi-number/check', requireAuth, handleConsumer('upiNumberAvailability', Joi.object({
  upiNumber: Joi.string().required(),
})));

router.post('/upi-number/create', requireAuth, handleConsumer('createUpiNumber', Joi.object({
  upiNumber: Joi.string().required(),
  vpa: Joi.string().required(),
})));

router.post('/upi-number/update', requireAuth, handleConsumer('updateUpiNumber', Joi.object({
  upiNumber: Joi.string().required(),
  vpa: Joi.string().required(),
})));

router.post('/upi-lite/status', requireAuth, handleConsumer('upiLiteStatus', Joi.object({
  bankAccountUniqueId: Joi.string().allow('', null),
  payerVpa: Joi.string().allow('', null),
})));

router.post('/complaints/raise', requireAuth, handleConsumer('complaintRaise', Joi.object({
  originalMerchantRequestId: Joi.string().required(),
  reason: Joi.string().required(),
  description: Joi.string().allow('', null),
})));

router.post('/complaints/status', requireAuth, handleConsumer('complaintStatus', Joi.object({
  complaintRequestId: Joi.string().required(),
})));

export default router;
