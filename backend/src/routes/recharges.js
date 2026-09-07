import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import { mobileRecharge, dthRecharge, fetchMobileOperators, fetchDthProviders, checkRechargeStatus } from '../services/clubapi.js';

const router = Router();

router.post('/mobile', requireAuth, async (req, res, next) => {
  try {
    const { mobile, operatorId, amount, customerMobile } = await Joi.object({
      mobile: Joi.string().required(),
      operatorId: Joi.string().required(),
      amount: Joi.number().min(1).required(),
      customerMobile: Joi.string().optional()
    }).validateAsync(req.body);

    const result = await mobileRecharge({ mobile, operatorId, amount, customerMobile });
    ok(res, result, 'Mobile recharge initiated');
  } catch (e) { next(e); }
});

router.post('/dth', requireAuth, async (req, res, next) => {
  try {
    const { subscriberId, operator, amount } = await Joi.object({
      subscriberId: Joi.string().required(),
      operator: Joi.string().required(),
      amount: Joi.number().min(1).required()
    }).validateAsync(req.body);

    const result = await dthRecharge({ subscriberId, operator, amount });
    if (result.status === 'SUCCESS') {
      ok(res, { txnId: result.txnId }, 'DTH recharge successful');
    } else {
      fail(res, 'RECHARGE_FAILED', result.message, 400);
    }
  } catch (e) { next(e); }
});

router.get('/operators/mobile', requireAuth, async (req, res, next) => {
  try {
    const operators = await fetchMobileOperators();
    ok(res, operators);
  } catch (e) { next(e); }
});

router.get('/operators/dth', requireAuth, async (req, res, next) => {
  try {
    const providers = await fetchDthProviders();
    ok(res, providers);
  } catch (e) { next(e); }
});

router.post('/status', requireAuth, async (req, res, next) => {
  try {
    const { urid } = await Joi.object({
      urid: Joi.string().required()
    }).validateAsync(req.body);

    const result = await checkRechargeStatus({ urid });
    ok(res, result);
  } catch (e) { next(e); }
});

export default router;
