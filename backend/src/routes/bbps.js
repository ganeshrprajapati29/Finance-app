import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { ok } from '../utils/response.js';
import { fetchBbpsBill, payBbpsBill, generateClubUrid } from '../services/clubapiUtility.js';

const router = Router();

const bbpsSchema = Joi.object({
  urid: Joi.string().max(20).default(() => generateClubUrid('KPB')),
  bbpsId: Joi.string().required(),
  operatorId: Joi.string().allow('', null),
  mobile: Joi.string().required(),
  customerMobile: Joi.string().pattern(/^\d{10}$/).required(),
  amount: Joi.alternatives().try(Joi.number().positive(), Joi.string()).optional(),
  opvalue1: Joi.string().allow('', null),
  opvalue2: Joi.string().allow('', null),
  opvalue3: Joi.string().allow('', null),
  opvalue4: Joi.string().allow('', null),
  opvalue5: Joi.string().allow('', null)
});

router.post(['/fetchbill', '/bbps/fetchbill', '/fetch-bill'], requireAuth, async (req, res, next) => {
  try {
    const payload = await bbpsSchema.validateAsync({
      ...req.body,
      bbpsId: req.body.bbpsId || req.body.operatorId
    });
    ok(res, await fetchBbpsBill(payload), 'BBPS bill fetched successfully');
  } catch (e) { next(e); }
});

router.post(['/pay', '/bbps/pay', '/pay-bill'], requireAuth, async (req, res, next) => {
  try {
    const payload = await bbpsSchema.fork(['amount'], (schema) => schema.required()).validateAsync({
      ...req.body,
      bbpsId: req.body.bbpsId || req.body.operatorId,
      urid: req.body.urid || generateClubUrid('KPY')
    });
    ok(res, await payBbpsBill(payload), 'BBPS payment initiated successfully');
  } catch (e) { next(e); }
});

export default router;
