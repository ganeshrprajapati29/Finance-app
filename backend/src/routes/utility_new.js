import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import {
  getTransactionStatus,
  getBalance,
  getOperatorList,
  raiseDispute,
  getStateList,
  getOperatorPlans,
  getMobileDetails,
  validateBankAccount,
  validateRechargeAmount
} from '../services/clubapiUtility.js';

const router = Router();

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
      urid: Joi.string().required(),
      customerMobile: Joi.string().required(),
      accountNumber: Joi.string().required(),
      ifscCode: Joi.string().required()
    }).validateAsync(req.body);

    const result = await validateBankAccount({ urid, customerMobile, accountNumber, ifscCode });
    ok(res, result);
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
      transType: Joi.string().required()
    }).validateAsync(req.body);

    const result = await validateRechargeAmount({ urid, mobile, operatorId, rechargeAmount, transType });
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
