import mongoose from 'mongoose';

import ClubAPITransaction from '../models/ClubAPITransaction.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { generateURID } from '../routes/clubapi/helper.js';
import {
  BILL_FETCH_TTL_MS,
  SERVICE_DEFINITIONS,
  validateFieldValues,
  validateServiceAmount,
} from '../config/serviceCatalog.js';
import { normalizeBillFetchResponse } from './clubapiResponse.js';
import { sendBillFetch } from './clubapiClient.js';
import {
  ServiceError,
  findRechargeProviderByCode,
  requireActiveProvider,
} from './serviceCatalogService.js';

const OPVALUE_KEYS = ['opvalue1', 'opvalue2', 'opvalue3', 'opvalue4', 'opvalue5'];

const pickOpvalues = (values = {}) =>
  Object.fromEntries(OPVALUE_KEYS.filter((key) => values[key]).map((key) => [key, values[key]]));

function tenDigitMobile(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(-10);
  return /^[6-9]\d{9}$/.test(digits) ? digits : '';
}

async function customerMobileFor(userId, override) {
  const typed = tenDigitMobile(override);
  if (typed) return typed;
  const user = await User.findById(userId).select('mobile').lean();
  const registered = tenDigitMobile(user?.mobile);
  if (!registered) {
    throw new ServiceError(
      'CUSTOMER_MOBILE_REQUIRED',
      'Add a valid 10-digit mobile number to your profile to use this service.'
    );
  }
  return registered;
}

function fieldError(errors) {
  const [firstKey] = Object.keys(errors);
  return new ServiceError('INVALID_DETAILS', errors[firstKey], 400, { fieldErrors: errors });
}

/** Customer-facing view of a recharge / bill payment. */
export function publicServiceTransaction(transaction) {
  if (!transaction) return null;
  const status = transaction.status;
  return {
    urid: transaction.urid,
    type: transaction.type,
    service: transaction.serviceKey || (transaction.type === 'bill_payment' ? null : transaction.type),
    status,
    displayStatus: status === 'completed' ? 'SUCCESS' : status === 'failed' ? 'FAILED' : 'PENDING',
    amount: transaction.amount,
    providerName: transaction.providerName || '',
    provider: transaction.provider,
    accountRef: transaction.accountRef,
    customerMobile: transaction.customerMobile,
    billId: transaction.billId,
    orderId: transaction.orderId || '',
    operatorTxnId: transaction.operatorTxnId || '',
    message: transaction.statusText || '',
    paymentId: transaction.paymentId ? String(transaction.paymentId) : null,
    refund: transaction.refund || null,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    completedAt: transaction.completedAt || null,
  };
}

/** What the app shows for a stored fetch. */
export function publicFetchedBill(transaction) {
  return {
    fetchId: transaction.urid,
    service: transaction.serviceKey,
    providerId: transaction.providerId ? String(transaction.providerId) : null,
    providerName: transaction.providerName,
    accountRef: transaction.accountRef,
    bill: transaction.bill || {},
    amountRule: transaction.amountRule || null,
    expiresAt: transaction.fetchExpiresAt,
  };
}

/* ---------------------------------------------------------------- bill fetch */

/**
 * Fetches a bill from ClubAPI and stores the exact request and result.
 *
 * The stored record is what payment later trusts: the bbpsId, account values
 * and the amount rule all come from here, not from the app, so a tampered
 * client cannot pay a different biller or break an EXACT amount rule.
 */
export async function fetchBillForUser({ userId, serviceKey, providerId, fields, customerMobile }) {
  const { definition, provider, fields: fieldDefs } = await requireActiveProvider(serviceKey, providerId);
  if (definition.kind !== 'bill') {
    throw new ServiceError('FETCH_NOT_SUPPORTED', `${definition.title} does not need a bill fetch.`);
  }
  if (provider.supportsFetch === false) {
    throw new ServiceError('FETCH_NOT_SUPPORTED', 'This biller does not support bill fetch. Enter the amount to pay.');
  }

  const { values, errors } = validateFieldValues(fieldDefs, fields);
  if (Object.keys(errors).length) throw fieldError(errors);

  const mobile = await customerMobileFor(userId, customerMobile);
  const urid = generateURID();
  const request = {
    bbpsId: provider.code,
    mobile: values.mobile,
    customerMobile: mobile,
    ...pickOpvalues(values),
  };

  const transaction = await ClubAPITransaction.create({
    urid,
    type: 'bill_fetch',
    status: 'processing',
    amount: 0,
    provider: provider.code,
    providerId: provider._id,
    providerName: provider.name,
    serviceKey,
    accountRef: values.mobile,
    customerMobile: mobile,
    request,
    userId,
  });

  const outcome = await sendBillFetch({
    urid,
    bbpsId: provider.code,
    mobile: values.mobile,
    customerMobile: mobile,
    opvalues: pickOpvalues(values),
  });

  if (outcome.delivery !== 'received') {
    transaction.status = 'failed';
    transaction.statusText = outcome.error;
    await transaction.save();
    throw new ServiceError(
      'BILL_FETCH_UNAVAILABLE',
      'The biller is not responding right now. Please try again in a few minutes.',
      503
    );
  }

  const parsed = normalizeBillFetchResponse(outcome.data, {
    min: definition.minAmount,
    max: definition.maxAmount,
  });

  transaction.response = outcome.data;
  transaction.orderId = parsed.orderId || undefined;
  transaction.statusText = parsed.message;

  if (!parsed.ok) {
    transaction.status = 'failed';
    await transaction.save();
    throw new ServiceError(
      'BILL_FETCH_FAILED',
      parsed.message ||
        'No bill was found for these details. Please check them and try again.',
      422
    );
  }

  transaction.status = 'completed';
  transaction.amount = parsed.bill.amount;
  transaction.bill = { ...parsed.bill, billerName: parsed.bill.billerName || provider.name };
  transaction.amountRule = parsed.amountRule;
  transaction.fetchExpiresAt = new Date(Date.now() + BILL_FETCH_TTL_MS);
  await transaction.save();

  return publicFetchedBill(transaction);
}

/* ------------------------------------------------------ payment resolution */

/**
 * Turns what the app asked to pay for into a server-verified payment.
 *
 * Input (`service`):
 *   recharge: { key: 'mobile'|'dth', providerId, accountNumber, amount }
 *   bill:     { key: 'credit_card'|'electricity'|'fastag', providerId, amount, fetchId }
 *             or, for a biller without fetch support, `fields` instead of fetchId
 *
 * @returns {Promise<{ paymentType: string, amount: number, metadata: object, summary: object }>}
 */
export async function resolveServicePayment({ userId, service }) {
  const serviceKey = String(service?.key || '').trim();
  const definition = SERVICE_DEFINITIONS[serviceKey];
  if (!definition) throw new ServiceError('UNKNOWN_SERVICE', 'This service is not available.');

  if (definition.kind === 'recharge') return resolveRecharge({ userId, service, definition });
  return resolveBill({ userId, service, definition });
}

async function resolveRecharge({ userId, service, definition }) {
  const { provider, fields } = await requireActiveProvider(definition.key, service.providerId);

  const { values, errors } = validateFieldValues(fields, {
    mobile: service.accountNumber ?? service.fields?.mobile,
  });
  if (Object.keys(errors).length) throw fieldError(errors);

  const checked = validateServiceAmount(definition.key, service.amount);
  if (checked.error) throw new ServiceError('INVALID_AMOUNT', checked.error);

  const accountRef = values.mobile;
  const customerMobile =
    definition.key === 'mobile' ? accountRef : await customerMobileFor(userId, service.customerMobile).catch(() => '');

  const snapshot = {
    key: definition.key,
    title: definition.title,
    providerId: String(provider._id),
    providerName: provider.name,
    accountRef,
  };

  return {
    paymentType: 'RECHARGE',
    amount: checked.amount,
    summary: snapshot,
    metadata: {
      notes: `${definition.title} - ${provider.name}`,
      service: snapshot,
      recharge: {
        type: definition.key,
        operatorId: provider.code,
        operatorName: provider.name,
        providerId: String(provider._id),
        accountRef,
        customerMobile: customerMobile || undefined,
        amount: checked.amount,
      },
    },
  };
}

async function resolveBill({ userId, service, definition }) {
  const { provider, fields } = await requireActiveProvider(definition.key, service.providerId);

  // Billers that cannot fetch are paid from validated fields + a typed amount.
  if (provider.supportsFetch === false) {
    const { values, errors } = validateFieldValues(fields, service.fields);
    if (Object.keys(errors).length) throw fieldError(errors);
    const checked = validateServiceAmount(definition.key, service.amount);
    if (checked.error) throw new ServiceError('INVALID_AMOUNT', checked.error);
    const customerMobile = await customerMobileFor(userId, service.customerMobile);
    return billPayment({
      definition,
      provider,
      amount: checked.amount,
      request: { bbpsId: provider.code, mobile: values.mobile, customerMobile, ...pickOpvalues(values) },
      fetch: null,
    });
  }

  const fetchId = String(service.fetchId || '').trim();
  if (!fetchId) {
    throw new ServiceError('BILL_FETCH_REQUIRED', 'Please fetch your bill before paying.');
  }

  const fetch = await ClubAPITransaction.findOne({ urid: fetchId, type: 'bill_fetch', userId }).lean();
  if (!fetch || fetch.status !== 'completed' || fetch.serviceKey !== definition.key) {
    throw new ServiceError('BILL_FETCH_INVALID', 'This bill is no longer valid. Please fetch it again.');
  }
  if (String(fetch.providerId) !== String(provider._id)) {
    throw new ServiceError('BILL_FETCH_INVALID', 'The biller changed. Please fetch the bill again.');
  }
  if (!fetch.fetchExpiresAt || new Date(fetch.fetchExpiresAt).getTime() < Date.now()) {
    throw new ServiceError('BILL_FETCH_EXPIRED', 'This bill was fetched a while ago. Please fetch it again.');
  }

  // One fetched bill, one successful payment. Guards against a double tap or a
  // retried order paying the same bill twice.
  const alreadyPaid = await Payment.exists({
    userId,
    type: 'BBPS_BILL',
    status: { $in: ['CONFIRMED'] },
    'metadata.clubapiBill.fetchId': fetchId,
  });
  if (alreadyPaid) {
    throw new ServiceError('BILL_ALREADY_PAID', 'This bill has already been paid.', 409);
  }

  const checked = validateServiceAmount(definition.key, service.amount, fetch.amountRule);
  if (checked.error) throw new ServiceError('INVALID_AMOUNT', checked.error);

  return billPayment({
    definition,
    provider,
    amount: checked.amount,
    request: fetch.request,
    fetch,
  });
}

function billPayment({ definition, provider, amount, request, fetch }) {
  const bill = fetch?.bill || {};
  const snapshot = {
    key: definition.key,
    title: definition.title,
    providerId: String(provider._id),
    providerName: provider.name,
    accountRef: request.mobile,
    customerName: bill.customerName || '',
    billNumber: bill.billNumber || '',
    dueDate: bill.dueDate || '',
    billAmount: bill.amount ?? null,
  };

  return {
    paymentType: 'BBPS_BILL',
    amount,
    summary: snapshot,
    metadata: {
      notes: `${definition.title} - ${provider.name}`,
      service: snapshot,
      clubapiBill: {
        serviceKey: definition.key,
        fetchId: fetch?.urid || null,
        billId: fetch?.urid || null,
        providerId: String(provider._id),
        billerName: provider.name,
        bbpsId: request.bbpsId,
        operatorId: request.bbpsId,
        mobile: request.mobile,
        accountRef: request.mobile,
        customerMobile: request.customerMobile,
        ...pickOpvalues(request),
        amount,
      },
    },
  };
}

/**
 * Accepts the payload shape older app builds send (`recharge` / `clubapiBill`)
 * and routes it through the same validation as the new `service` payload.
 * Nothing the client says about operator ids or bill amounts is trusted.
 */
export async function resolveLegacyServicePayment({ userId, recharge, clubapiBill, amount }) {
  if (recharge) {
    const key = String(recharge.type || '').toLowerCase();
    const provider = await findRechargeProviderByCode(key, recharge.operatorId);
    if (!provider) {
      throw new ServiceError(
        'PROVIDER_UNAVAILABLE',
        'This operator is not available. Please update the app and try again.'
      );
    }
    return resolveServicePayment({
      userId,
      service: {
        key,
        providerId: String(provider._id),
        accountNumber: recharge.accountRef,
        customerMobile: recharge.customerMobile,
        amount,
      },
    });
  }

  if (clubapiBill) {
    const fetchId = String(clubapiBill.fetchId || clubapiBill.billId || '').trim();
    const fetch = fetchId && mongoose.isValidObjectId(userId)
      ? await ClubAPITransaction.findOne({ urid: fetchId, type: 'bill_fetch', userId }).lean()
      : null;
    if (!fetch?.serviceKey || !fetch?.providerId) {
      throw new ServiceError('BILL_FETCH_REQUIRED', 'Please fetch your bill again before paying.');
    }
    return resolveServicePayment({
      userId,
      service: { key: fetch.serviceKey, providerId: String(fetch.providerId), fetchId, amount },
    });
  }

  throw new ServiceError('SERVICE_DETAILS_REQUIRED', 'Recharge or bill details are required.');
}
