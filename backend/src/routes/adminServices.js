import { Router } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';

import ServiceProvider from '../models/ServiceProvider.js';
import ClubAPITransaction from '../models/ClubAPITransaction.js';
import AuditLog from '../models/AuditLog.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { ok, fail } from '../utils/response.js';
import {
  FIELD_KEYS,
  INPUT_TYPES,
  SERVICE_DEFINITIONS,
  SERVICE_KEYS,
  effectiveFields,
  publicServiceDefinition,
  sanitizeFields,
} from '../config/serviceCatalog.js';
import {
  ServiceError,
  ensureSeeded,
  syncProvidersFromClubapi,
} from '../services/serviceCatalogService.js';
import { syncTransactionStatus } from '../services/rechargePaymentService.js';
import { checkRazorpayConnection } from '../services/razorpay.js';
import { isClubapiConfigured, postClubapi, runtimeClubapiSettings } from '../services/clubapiClient.js';
import { normalizeBalanceResponse } from '../services/clubapiResponse.js';
import clubapiConfig from '../config/clubapi.js';

/**
 * Admin management of the recharge & bill catalog.
 *
 *   GET    /api/admin/services/health           Razorpay / ClubAPI / catalog checks from this server
 *   GET    /api/admin/services/catalog          all providers (enabled or not)
 *   POST   /api/admin/services/sync             import operators from ClubAPI
 *   POST   /api/admin/services/providers        add a provider
 *   PUT    /api/admin/services/providers/:id    edit a provider
 *   DELETE /api/admin/services/providers/:id    remove a provider
 *   POST   /api/admin/services/transactions/:id/refresh  re-check a pending txn
 */
const router = Router();

const fieldSchema = Joi.object({
  key: Joi.string().valid(...FIELD_KEYS).required(),
  label: Joi.string().trim().min(2).max(60).required(),
  placeholder: Joi.string().trim().allow('').max(80).default(''),
  hint: Joi.string().trim().allow('').max(160).default(''),
  inputType: Joi.string().valid(...INPUT_TYPES).default('text'),
  minLength: Joi.number().integer().min(0).max(64).default(0),
  maxLength: Joi.number().integer().min(1).max(64).default(64),
  pattern: Joi.string().allow('').max(200).default(''),
  uppercase: Joi.boolean().default(false),
});

const providerSchema = Joi.object({
  service: Joi.string().valid(...SERVICE_KEYS).required(),
  name: Joi.string().trim().min(2).max(120).required(),
  code: Joi.string().trim().min(1).max(40).required(),
  state: Joi.string().trim().allow('').max(60).default(''),
  enabled: Joi.boolean().default(true),
  sortOrder: Joi.number().integer().min(0).max(10000).default(100),
  supportsFetch: Joi.boolean().default(true),
  fields: Joi.array().items(fieldSchema).max(6).default([]),
});

async function audit(req, action, provider, meta = {}) {
  try {
    await AuditLog.create({
      actorId: req.admin?.id,
      action,
      entityType: 'ServiceProvider',
      entityId: String(provider?._id || ''),
      meta: { service: provider?.service, name: provider?.name, code: provider?.code, ...meta },
    });
  } catch (error) {
    console.error('Audit log failed:', error.message);
  }
}

function validateFieldPatterns(fields) {
  for (const field of fields) {
    if (!field.pattern) continue;
    try {
      new RegExp(field.pattern);
    } catch {
      return `The pattern for "${field.label}" is not a valid regular expression.`;
    }
  }
  if (fields.length && !fields.some((field) => field.key === 'mobile')) {
    return 'Add a field for the "mobile" parameter - it is the primary account value ClubAPI requires.';
  }
  return null;
}

function adminProvider(provider) {
  return {
    ...provider,
    id: String(provider._id),
    usesDefaultFields: !(provider.fields || []).some((field) => field.key === 'mobile'),
    effectiveFields: effectiveFields(provider.service, provider.fields),
  };
}

/**
 * Checks, from this server, everything a recharge / bill payment depends on.
 * Nothing here moves money: Razorpay is checked with a read-only call and
 * ClubAPI with its balance API.
 */
router.get('/health', requireAdmin, async (req, res, next) => {
  try {
    await ensureSeeded();
    const [razorpay, settings, providers] = await Promise.all([
      checkRazorpayConnection(),
      runtimeClubapiSettings(),
      ServiceProvider.find().select('service enabled').lean(),
    ]);

    let baseHost = '';
    try {
      baseHost = new URL(clubapiConfig.baseURL).host;
    } catch {
      baseHost = String(clubapiConfig.baseURL || '');
    }

    const clubapi = {
      configured: isClubapiConfigured(),
      baseHost,
      sandbox: /sandbox/i.test(baseHost),
      callbackIdConfigured: Boolean(settings.callbackId || clubapiConfig.callbackId),
      callbackSecretConfigured: Boolean(String(process.env.CLUBAPI_CALLBACK_SECRET || '').trim()),
      ok: false,
      message: '',
      balance: null,
    };

    if (!clubapi.configured) {
      clubapi.message = 'CLUBAPI_TOKEN is not set on the server.';
    } else {
      const outcome = await postClubapi('/utility/balance.php', {}, { timeout: 20000 });
      if (outcome.delivery !== 'received') {
        clubapi.message = `ClubAPI could not be reached from this server: ${outcome.error || 'no response'}`;
      } else {
        const parsed = normalizeBalanceResponse(outcome.data);
        clubapi.ok = parsed.ok;
        clubapi.balance = parsed.ok ? { total: parsed.total, p2a: parsed.p2a, p2p: parsed.p2p } : null;
        clubapi.message = parsed.ok
          ? 'ClubAPI accepted the token from this server.'
          : `ClubAPI rejected the request: ${parsed.message || `HTTP ${outcome.httpStatus}`}. Check the token and that this server's IP is whitelisted.`;
      }
    }

    const catalog = Object.fromEntries(
      SERVICE_KEYS.map((key) => {
        const rows = providers.filter((provider) => provider.service === key);
        return [key, { total: rows.length, enabled: rows.filter((provider) => provider.enabled).length }];
      })
    );

    const services = {
      enabled: settings.enabled !== false,
      mobileRechargeEnabled: settings.mobileRechargeEnabled !== false,
      dthRechargeEnabled: settings.dthRechargeEnabled !== false,
      billFetchEnabled: settings.billFetchEnabled !== false,
      billPaymentEnabled: settings.billPaymentEnabled !== false,
    };

    const problems = [];
    if (!razorpay.ok) problems.push(`Razorpay: ${razorpay.message}`);
    if (!razorpay.webhookSecretConfigured) problems.push('Razorpay webhook secret is not set.');
    if (!clubapi.ok) problems.push(`ClubAPI: ${clubapi.message}`);
    if (clubapi.sandbox) problems.push('ClubAPI is pointing at the SANDBOX host.');
    for (const [key, counts] of Object.entries(catalog)) {
      if (!counts.enabled) problems.push(`No enabled providers for ${SERVICE_DEFINITIONS[key].title}.`);
    }

    ok(res, {
      checkedAt: new Date(),
      ready: razorpay.ok && clubapi.ok,
      problems,
      razorpay,
      clubapi,
      catalog,
      services,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/catalog', requireAdmin, async (req, res, next) => {
  try {
    await ensureSeeded();
    const providers = await ServiceProvider.find().sort({ service: 1, sortOrder: 1, name: 1 }).lean();

    const services = SERVICE_KEYS.map((key) => ({
      ...publicServiceDefinition(SERVICE_DEFINITIONS[key]),
      defaultFields: effectiveFields(key, []),
      providers: providers.filter((provider) => provider.service === key).map(adminProvider),
    }));

    ok(res, { services, fieldKeys: FIELD_KEYS, inputTypes: INPUT_TYPES });
  } catch (error) {
    next(error);
  }
});

router.post('/sync', requireAdmin, async (req, res, next) => {
  try {
    const summary = await syncProvidersFromClubapi();
    await AuditLog.create({
      actorId: req.admin?.id,
      action: 'SYNC_SERVICE_PROVIDERS',
      entityType: 'ServiceProvider',
      entityId: 'clubapi',
      meta: { received: summary.received, added: summary.added.length, skipped: summary.skipped },
    }).catch(() => {});
    ok(
      res,
      summary,
      summary.added.length
        ? `Added ${summary.added.length} new provider(s) from ClubAPI`
        : 'Catalog is already up to date with ClubAPI'
    );
  } catch (error) {
    if (error instanceof ServiceError) return fail(res, error.code, error.message, error.status);
    next(error);
  }
});

router.post('/providers', requireAdmin, async (req, res, next) => {
  try {
    const body = await providerSchema.validateAsync(req.body);
    const patternError = validateFieldPatterns(body.fields);
    if (patternError) return fail(res, 'INVALID_FIELDS', patternError, 400);

    const exists = await ServiceProvider.exists({ service: body.service, code: body.code });
    if (exists) {
      return fail(res, 'PROVIDER_EXISTS', 'A provider with this ID already exists for this service.', 409);
    }

    const provider = await ServiceProvider.create({
      ...body,
      fields: sanitizeFields(body.fields),
      source: 'admin',
    });
    await audit(req, 'CREATE_SERVICE_PROVIDER', provider);
    ok(res, adminProvider(provider.toObject()), 'Provider added', { status: 201 });
  } catch (error) {
    next(error);
  }
});

router.put('/providers/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'NOT_FOUND', 'Provider not found', 404);

    const body = await providerSchema
      .fork(['service', 'name', 'code'], (schema) => schema.optional())
      .validateAsync(req.body, { noDefaults: true });

    if (body.fields) {
      const patternError = validateFieldPatterns(body.fields);
      if (patternError) return fail(res, 'INVALID_FIELDS', patternError, 400);
      body.fields = sanitizeFields(body.fields);
    }

    const current = await ServiceProvider.findById(req.params.id);
    if (!current) return fail(res, 'NOT_FOUND', 'Provider not found', 404);

    const nextService = body.service || current.service;
    const nextCode = body.code || current.code;
    if (nextService !== current.service || nextCode !== current.code) {
      const clash = await ServiceProvider.exists({ _id: { $ne: current._id }, service: nextService, code: nextCode });
      if (clash) return fail(res, 'PROVIDER_EXISTS', 'Another provider already uses this ID.', 409);
    }

    Object.assign(current, body);
    await current.save();
    await audit(req, 'UPDATE_SERVICE_PROVIDER', current, { changes: Object.keys(body) });
    ok(res, adminProvider(current.toObject()), 'Provider updated');
  } catch (error) {
    next(error);
  }
});

router.delete('/providers/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'NOT_FOUND', 'Provider not found', 404);
    const provider = await ServiceProvider.findByIdAndDelete(req.params.id);
    if (!provider) return fail(res, 'NOT_FOUND', 'Provider not found', 404);
    await audit(req, 'DELETE_SERVICE_PROVIDER', provider);
    ok(res, { id: req.params.id }, 'Provider removed');
  } catch (error) {
    next(error);
  }
});

router.post('/transactions/:id/refresh', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'NOT_FOUND', 'Transaction not found', 404);
    const transaction = await ClubAPITransaction.findById(req.params.id);
    if (!transaction) return fail(res, 'NOT_FOUND', 'Transaction not found', 404);
    const refreshed = await syncTransactionStatus(transaction, { force: true });
    ok(res, refreshed, `Status: ${refreshed?.status || transaction.status}`);
  } catch (error) {
    next(error);
  }
});

export default router;
