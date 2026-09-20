import { Router } from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';

import ClubAPITransaction from '../models/ClubAPITransaction.js';
import { requireAuth } from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';
import { SERVICE_KEYS } from '../config/serviceCatalog.js';
import {
  ServiceError,
  detectMobileOperator,
  getMobilePlans,
  getPublicCatalog,
} from '../services/serviceCatalogService.js';
import { fetchBillForUser, publicServiceTransaction } from '../services/servicePaymentService.js';
import { syncTransactionStatus } from '../services/rechargePaymentService.js';

/**
 * Recharge & bill services for the app: Mobile, DTH, Credit Card, Electricity
 * and FASTag.
 *
 *   GET  /api/services/catalog                 services, providers, input fields
 *   GET  /api/services/mobile/operator?number=  operator suggestion
 *   GET  /api/services/mobile/plans?providerId= prepaid plans
 *   POST /api/services/bills/fetch             fetch a bill (stored server-side)
 *   GET  /api/services/transactions            the user's recharges & bill payments
 *   GET  /api/services/transactions/:urid      live status of one transaction
 *
 * Paying goes through /api/payments/razorpay/order or /api/payments/wallet/service
 * with a `service` payload, which re-validates everything here on the server.
 */
const router = Router();

const userKey = (req) => String(req.user?.uid || req.ip);

// Bill fetches reach the biller and may consume ClubAPI credit.
const fetchLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  validate: false,
  handler: (req, res) =>
    fail(res, 'TOO_MANY_BILL_FETCHES', 'Too many bill fetches. Please wait a few minutes and try again.', 429),
});

const lookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  validate: false,
  handler: (req, res) => fail(res, 'TOO_MANY_REQUESTS', 'Please slow down and try again shortly.', 429),
});

function handleServiceError(error, res, next) {
  if (error instanceof ServiceError) {
    return fail(res, error.code, error.message, error.status, error.data);
  }
  return next(error);
}

router.get('/catalog', requireAuth, async (req, res, next) => {
  try {
    ok(res, await getPublicCatalog(), 'Services loaded');
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

router.get('/mobile/operator', requireAuth, lookupLimiter, async (req, res, next) => {
  try {
    const { number } = await Joi.object({
      number: Joi.string().trim().pattern(/^\+?\d{10,13}$/).required(),
    }).validateAsync(req.query);
    const detected = await detectMobileOperator(number);
    ok(res, detected, detected ? 'Operator detected' : 'Operator could not be detected');
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

router.get('/mobile/plans', requireAuth, lookupLimiter, async (req, res, next) => {
  try {
    const { providerId, stateId } = await Joi.object({
      providerId: Joi.string().trim().required(),
      stateId: Joi.string().trim().allow('').default(''),
    }).validateAsync(req.query);
    ok(res, await getMobilePlans(providerId, stateId), 'Plans loaded');
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

router.post('/bills/fetch', requireAuth, fetchLimiter, async (req, res, next) => {
  try {
    const body = await Joi.object({
      service: Joi.string().valid('credit_card', 'electricity', 'fastag').required(),
      providerId: Joi.string().trim().required(),
      fields: Joi.object().pattern(/^(mobile|opvalue[1-5])$/, Joi.string().allow('').max(64)).required(),
      customerMobile: Joi.string().trim().allow('', null),
    }).validateAsync(req.body);

    const fetched = await fetchBillForUser({
      userId: req.user.uid,
      serviceKey: body.service,
      providerId: body.providerId,
      fields: body.fields,
      customerMobile: body.customerMobile,
    });
    ok(res, fetched, 'Bill fetched successfully', { code: 'BILL_FETCHED' });
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

router.get('/transactions', requireAuth, async (req, res, next) => {
  try {
    const { service, limit, page } = await Joi.object({
      service: Joi.string().valid(...SERVICE_KEYS).allow(''),
      limit: Joi.number().integer().min(1).max(100).default(30),
      page: Joi.number().integer().min(1).default(1),
    }).validateAsync(req.query);

    const query = { userId: req.user.uid, type: { $in: ['mobile', 'dth', 'bill_payment'] } };
    if (service) query.serviceKey = service;

    const [rows, total] = await Promise.all([
      ClubAPITransaction.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      ClubAPITransaction.countDocuments(query),
    ]);

    ok(res, {
      transactions: rows.map(publicServiceTransaction),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

router.get('/transactions/:urid', requireAuth, lookupLimiter, async (req, res, next) => {
  try {
    const transaction = await ClubAPITransaction.findOne({
      urid: String(req.params.urid || '').trim(),
      userId: req.user.uid,
      type: { $in: ['mobile', 'dth', 'bill_payment'] },
    });
    if (!transaction) return fail(res, 'TRANSACTION_NOT_FOUND', 'Transaction not found', 404);

    // Throttled inside; safe to call on every poll.
    const refreshed = await syncTransactionStatus(transaction);
    ok(res, publicServiceTransaction(refreshed || transaction));
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

export default router;
