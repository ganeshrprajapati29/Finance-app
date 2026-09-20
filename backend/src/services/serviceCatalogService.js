import mongoose from 'mongoose';

import ServiceProvider from '../models/ServiceProvider.js';
import { generateURID } from '../routes/clubapi/helper.js';
import {
  DOCUMENTED_PROVIDERS,
  SERVICE_DEFINITIONS,
  SERVICE_KEYS,
  classifyOperator,
  effectiveFields,
  publicServiceDefinition,
} from '../config/serviceCatalog.js';
import {
  normalizeMobileSeries,
  normalizeOperatorList,
  normalizePlans,
} from './clubapiResponse.js';
import {
  runtimeClubapiSettings,
  sendMobileDetails,
  sendMobilePlans,
  sendOperatorList,
} from './clubapiClient.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export class ServiceError extends Error {
  constructor(code, message, status = 400, data = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

/* ------------------------------------------------------------------ seeding */

let seeded = false;

/**
 * Inserts the providers whose IDs ClubAPI documents publicly. Uses
 * $setOnInsert so an admin's later edits are never overwritten.
 */
export async function ensureSeeded() {
  if (seeded) return;
  await Promise.all(
    DOCUMENTED_PROVIDERS.map((provider) =>
      ServiceProvider.updateOne(
        { service: provider.service, code: provider.operatorId || provider.bbpsId },
        {
          $setOnInsert: {
            service: provider.service,
            code: provider.operatorId || provider.bbpsId,
            name: provider.name,
            state: provider.state || '',
            sortOrder: provider.sortOrder ?? 100,
            fields: provider.fields || [],
            enabled: true,
            supportsFetch: true,
            source: 'seed',
          },
        },
        { upsert: true }
      )
    )
  );
  seeded = true;
}

/* ------------------------------------------------------------------ catalog */

function serviceEnabled(definition, settings) {
  if (settings?.enabled === false) return false;
  if (definition.kind === 'bill' && settings?.billFetchEnabled === false) return false;
  return settings?.[definition.settingsFlag] !== false;
}

export function publicProvider(provider) {
  const definition = SERVICE_DEFINITIONS[provider.service];
  return {
    id: String(provider._id),
    service: provider.service,
    name: provider.name,
    state: provider.state || '',
    fields: effectiveFields(provider.service, provider.fields),
    supportsFetch: definition?.kind === 'bill' ? provider.supportsFetch !== false : false,
  };
}

/** The catalog shown in the app: enabled services and their enabled providers. */
export async function getPublicCatalog() {
  await ensureSeeded();
  const settings = await runtimeClubapiSettings();

  const providers = await ServiceProvider.find({ enabled: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const services = SERVICE_KEYS.map((key) => SERVICE_DEFINITIONS[key]).map((definition) => {
    const rows = providers.filter((provider) => provider.service === definition.key);
    const available = serviceEnabled(definition, settings);
    return {
      ...publicServiceDefinition(definition),
      available,
      unavailableReason: available ? null : 'This service is temporarily unavailable.',
      defaultFields: effectiveFields(definition.key, []),
      providers: available ? rows.map(publicProvider) : [],
    };
  });

  return { services };
}

/**
 * Loads a provider a customer selected, enforcing that it is enabled and
 * belongs to the requested service (so an electricity biller id can never be
 * charged as a recharge, or a disabled biller be used via a stale app screen).
 */
export async function requireActiveProvider(serviceKey, providerId) {
  const definition = SERVICE_DEFINITIONS[serviceKey];
  if (!definition) throw new ServiceError('UNKNOWN_SERVICE', 'This service is not available.');

  const settings = await runtimeClubapiSettings();
  if (!serviceEnabled(definition, settings)) {
    throw new ServiceError('SERVICE_UNAVAILABLE', `${definition.title} is temporarily unavailable.`, 503);
  }

  if (!mongoose.isValidObjectId(providerId)) {
    throw new ServiceError('PROVIDER_REQUIRED', `Please select a ${definition.providerLabel.toLowerCase()}.`);
  }

  const provider = await ServiceProvider.findOne({ _id: providerId, service: serviceKey }).lean();
  if (!provider || !provider.enabled) {
    throw new ServiceError(
      'PROVIDER_UNAVAILABLE',
      `This ${definition.providerLabel.toLowerCase()} is not available right now. Please choose another.`
    );
  }
  return { definition, provider, fields: effectiveFields(serviceKey, provider.fields) };
}

/** Resolves a legacy request that identified a recharge operator by id. */
export async function findRechargeProviderByCode(serviceKey, code) {
  await ensureSeeded();
  if (!['mobile', 'dth'].includes(serviceKey) || !code) return null;
  return ServiceProvider.findOne({ service: serviceKey, code: String(code).trim(), enabled: true }).lean();
}

/* ------------------------------------------------------ operator detection */

let seriesCache = { at: 0, map: null, inflight: null };

async function loadMobileSeries() {
  if (seriesCache.map && Date.now() - seriesCache.at < DAY_MS) return seriesCache.map;
  if (seriesCache.inflight) return seriesCache.inflight;

  seriesCache.inflight = (async () => {
    const outcome = await sendMobileDetails();
    const map = outcome.delivery === 'received' ? normalizeMobileSeries(outcome.data) : new Map();
    // Cache an empty result briefly too, so a ClubAPI outage does not turn
    // every keystroke into an upstream call.
    seriesCache = {
      at: map.size ? Date.now() : Date.now() - DAY_MS + 10 * 60 * 1000,
      map,
      inflight: null,
    };
    return map;
  })();

  try {
    return await seriesCache.inflight;
  } finally {
    seriesCache.inflight = null;
  }
}

/**
 * Suggests the operator for a mobile number from its 4-digit series. ClubAPI
 * says this is a suggestion only (numbers port), so the app lets the user
 * change it.
 */
export async function detectMobileOperator(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(digits)) {
    throw new ServiceError('INVALID_MOBILE', 'Enter a valid 10-digit mobile number.');
  }

  const series = await loadMobileSeries();
  const match = series.get(digits.slice(0, 4));
  if (!match?.operatorId) return null;

  await ensureSeeded();
  const provider = await ServiceProvider.findOne({
    service: 'mobile',
    code: match.operatorId,
    enabled: true,
  }).lean();
  if (!provider) return null;

  return {
    providerId: String(provider._id),
    providerName: provider.name,
    circle: match.circle,
    stateId: match.stateId,
  };
}

/* -------------------------------------------------------------------- plans */

const planCache = new Map();

/**
 * Prepaid plans for an operator. ClubAPI asks integrators to call this at most
 * once a day and store the result, so plans are cached per operator for 24h.
 */
export async function getMobilePlans(providerId, stateId = '') {
  const { provider } = await requireActiveProvider('mobile', providerId);
  const cached = planCache.get(provider.code);

  let plans = cached && Date.now() - cached.at < DAY_MS ? cached.plans : null;
  if (!plans) {
    const outcome = await sendMobilePlans({ operatorId: provider.code, urid: generateURID() });
    plans = outcome.delivery === 'received' ? normalizePlans(outcome.data) : [];
    if (plans.length) planCache.set(provider.code, { at: Date.now(), plans });
  }

  const wantedState = String(stateId || '').trim();
  const scoped = wantedState
    ? plans.filter((plan) => !plan.stateId || plan.stateId === wantedState)
    : plans;

  // One entry per amount+type, cheapest first within each category.
  const unique = new Map();
  for (const plan of scoped) {
    const key = `${plan.type}:${plan.amount}`;
    if (!unique.has(key)) unique.set(key, plan);
  }

  const sorted = [...unique.values()].sort((a, b) => a.amount - b.amount);
  const categories = [...new Set(sorted.map((plan) => plan.type))];

  return {
    provider: { id: String(provider._id), name: provider.name },
    categories,
    plans: sorted.map(({ stateId: _s, operatorId: _o, ...plan }) => plan),
  };
}

/* --------------------------------------------------------------------- sync */

/**
 * Pulls ClubAPI's operator list and adds any operator/biller that belongs to
 * one of the five services and is not in the catalog yet. Existing providers
 * are never renamed, re-enabled or have their fields changed - only their
 * `clubapiName`/`lastSyncedAt` are refreshed - so admin corrections survive.
 */
export async function syncProvidersFromClubapi() {
  await ensureSeeded();
  const outcome = await sendOperatorList();

  if (outcome.delivery !== 'received') {
    throw new ServiceError(
      'CLUBAPI_UNREACHABLE',
      outcome.error || 'ClubAPI could not be reached. Check the token and the server IP whitelist.',
      502
    );
  }

  const operators = normalizeOperatorList(outcome.data);
  if (!operators.length) {
    const reason = String(outcome.data?.resText || outcome.data?.message || '').trim();
    throw new ServiceError(
      'CLUBAPI_EMPTY_OPERATOR_LIST',
      reason || 'ClubAPI returned no operators. Check that the API token is active.',
      502
    );
  }

  const summary = { received: operators.length, added: [], refreshed: 0, skipped: 0 };
  const now = new Date();

  for (const operator of operators) {
    const service = classifyOperator(operator);
    if (!service) {
      summary.skipped += 1;
      continue;
    }

    const code = SERVICE_DEFINITIONS[service].kind === 'bill' ? operator.bbpsId : operator.operatorId;
    if (!code) {
      summary.skipped += 1;
      continue;
    }

    const result = await ServiceProvider.updateOne(
      { service, code },
      {
        $set: { clubapiName: operator.name, lastSyncedAt: now },
        $setOnInsert: {
          service,
          code,
          name: operator.name,
          enabled: true,
          sortOrder: 100,
          fields: [],
          supportsFetch: true,
          source: 'clubapi_sync',
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount) summary.added.push({ service, name: operator.name, code });
    else summary.refreshed += 1;
  }

  return summary;
}
