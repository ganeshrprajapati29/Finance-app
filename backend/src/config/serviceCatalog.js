/**
 * The five services Khatu Pay offers, and the rules that apply to them.
 *
 * Why this exists: ClubAPI's operatorList returns only `name`, `operatorId`
 * and `gstMode`. It does not return BBPS biller IDs, nor the input fields a
 * biller needs ("Consumer number", "Last 4 digits of card"...). So which
 * billers exist, their bbpsId and their input fields are stored per provider
 * (see models/ServiceProvider.js, managed from the admin panel), and this file
 * holds the defaults and validation shared by the API, the payment flow and
 * the admin sync.
 *
 * Field `key` is the ClubAPI request parameter the value is sent as:
 *   mobile   -> the primary account value ("mobile number or consumer number")
 *   opvalue1..opvalue5 -> additional values some billers require
 *
 * Everything here is pure (no I/O) so it can be unit tested.
 */

export const SERVICE_KEYS = ['mobile', 'dth', 'credit_card', 'electricity', 'fastag'];
export const FIELD_KEYS = ['mobile', 'opvalue1', 'opvalue2', 'opvalue3', 'opvalue4', 'opvalue5'];
export const INPUT_TYPES = ['mobile', 'number', 'text'];

/** Maximum Razorpay order this app creates (mirrors routes/payments.js). */
export const MAX_ORDER_AMOUNT = 100000;

/** A fetched bill can be paid for this long before it must be fetched again. */
export const BILL_FETCH_TTL_MS = 30 * 60 * 1000;

const mobileField = (label = 'Mobile number') => ({
  key: 'mobile',
  label,
  placeholder: '10-digit mobile number',
  hint: '',
  inputType: 'mobile',
  minLength: 10,
  maxLength: 10,
  pattern: '^[6-9][0-9]{9}$',
  uppercase: false,
});

export const SERVICE_DEFINITIONS = {
  mobile: {
    key: 'mobile',
    title: 'Mobile Recharge',
    subtitle: 'Prepaid recharge for all operators',
    kind: 'recharge',
    paymentType: 'RECHARGE',
    providerLabel: 'Operator',
    minAmount: 10,
    maxAmount: 10000,
    wholeRupees: true,
    supportsPlans: true,
    supportsOperatorDetect: true,
    defaultFields: [mobileField('Mobile number')],
    settingsFlag: 'mobileRechargeEnabled',
  },
  dth: {
    key: 'dth',
    title: 'DTH Recharge',
    subtitle: 'Tata Play, Airtel, Dish TV & more',
    kind: 'recharge',
    paymentType: 'RECHARGE',
    providerLabel: 'DTH operator',
    minAmount: 100,
    maxAmount: 25000,
    wholeRupees: true,
    supportsPlans: false,
    supportsOperatorDetect: false,
    defaultFields: [
      {
        key: 'mobile',
        label: 'Subscriber ID / Customer ID',
        placeholder: 'Registered mobile or subscriber ID',
        hint: 'Shown on your set-top box welcome screen or recharge SMS',
        inputType: 'number',
        minLength: 6,
        maxLength: 16,
        pattern: '^[0-9]{6,16}$',
        uppercase: false,
      },
    ],
    settingsFlag: 'dthRechargeEnabled',
  },
  credit_card: {
    key: 'credit_card',
    title: 'Credit Card Bill',
    subtitle: 'Pay any bank credit card via BBPS',
    kind: 'bill',
    paymentType: 'BBPS_BILL',
    providerLabel: 'Card issuing bank',
    minAmount: 1,
    maxAmount: MAX_ORDER_AMOUNT,
    wholeRupees: false,
    supportsPlans: false,
    supportsOperatorDetect: false,
    defaultFields: [
      mobileField('Registered mobile number'),
      {
        key: 'opvalue1',
        label: 'Last 4 digits of credit card',
        placeholder: 'XXXX',
        hint: 'Only the last 4 digits. Never share your full card number or CVV.',
        inputType: 'number',
        minLength: 4,
        maxLength: 4,
        pattern: '^[0-9]{4}$',
        uppercase: false,
      },
    ],
    settingsFlag: 'billPaymentEnabled',
  },
  electricity: {
    key: 'electricity',
    title: 'Electricity Bill',
    subtitle: 'All state electricity boards',
    kind: 'bill',
    paymentType: 'BBPS_BILL',
    providerLabel: 'Electricity board',
    minAmount: 1,
    maxAmount: MAX_ORDER_AMOUNT,
    wholeRupees: false,
    supportsPlans: false,
    supportsOperatorDetect: false,
    defaultFields: [
      {
        key: 'mobile',
        label: 'Consumer number',
        placeholder: 'As printed on your electricity bill',
        hint: 'Also called CA number, account number or K number',
        inputType: 'text',
        minLength: 4,
        maxLength: 24,
        pattern: '^[A-Z0-9/-]{4,24}$',
        uppercase: true,
      },
    ],
    settingsFlag: 'billPaymentEnabled',
  },
  fastag: {
    key: 'fastag',
    title: 'FASTag Recharge',
    subtitle: 'Recharge FASTag of any issuer bank',
    kind: 'bill',
    paymentType: 'BBPS_BILL',
    providerLabel: 'FASTag issuer bank',
    minAmount: 100,
    maxAmount: MAX_ORDER_AMOUNT,
    wholeRupees: true,
    supportsPlans: false,
    supportsOperatorDetect: false,
    defaultFields: [
      {
        key: 'mobile',
        label: 'Vehicle registration number',
        placeholder: 'e.g. MH12AB1234',
        hint: 'Enter without spaces',
        inputType: 'text',
        minLength: 6,
        maxLength: 12,
        pattern: '^[A-Z0-9]{6,12}$',
        uppercase: true,
      },
    ],
    settingsFlag: 'billPaymentEnabled',
  },
};

/**
 * Providers whose IDs are published in ClubAPI's own documentation, used to
 * seed an empty catalog. Everything else is added through "Sync from ClubAPI"
 * or entered by an admin from the ClubAPI panel's biller list - biller IDs are
 * never guessed.
 */
export const DOCUMENTED_PROVIDERS = [
  { service: 'mobile', name: 'Airtel', operatorId: '1', sortOrder: 1 },
  { service: 'mobile', name: 'Vi (Vodafone Idea)', operatorId: '2', sortOrder: 2 },
  { service: 'mobile', name: 'Jio', operatorId: '3', sortOrder: 3 },
  { service: 'mobile', name: 'BSNL', operatorId: '4', sortOrder: 4 },
  {
    service: 'electricity',
    name: 'Uttar Pradesh Power Corp Ltd (UPPCL) - Urban',
    bbpsId: 'UPPCL0000UTP02',
    state: 'Uttar Pradesh',
    sortOrder: 1,
    fields: [
      {
        key: 'mobile',
        label: 'Consumer / account number',
        placeholder: '10 to 12 digit account number',
        hint: 'Printed as "Account No." on your UPPCL bill',
        inputType: 'number',
        minLength: 10,
        maxLength: 12,
        pattern: '^[0-9]{10,12}$',
        uppercase: false,
      },
    ],
  },
];

/* ----------------------------------------------------------------- fields */

/**
 * Sanitises an admin-supplied field list. Invalid entries are dropped rather
 * than rejected so a partially wrong edit never takes a biller offline.
 */
export function sanitizeFields(fields) {
  if (!Array.isArray(fields)) return [];
  const seen = new Set();
  const result = [];

  for (const raw of fields) {
    if (!raw || typeof raw !== 'object') continue;
    const key = String(raw.key || '').trim();
    const label = String(raw.label || '').trim();
    if (!FIELD_KEYS.includes(key) || !label || seen.has(key)) continue;

    let pattern = String(raw.pattern || '').trim();
    if (pattern) {
      try {
        new RegExp(pattern);
      } catch {
        pattern = '';
      }
    }

    const minLength = Math.max(0, Math.min(64, parseInt(raw.minLength, 10) || 0));
    const maxLength = Math.max(minLength || 1, Math.min(64, parseInt(raw.maxLength, 10) || 64));

    seen.add(key);
    result.push({
      key,
      label: label.slice(0, 60),
      placeholder: String(raw.placeholder || '').trim().slice(0, 80),
      hint: String(raw.hint || '').trim().slice(0, 160),
      inputType: INPUT_TYPES.includes(raw.inputType) ? raw.inputType : 'text',
      minLength,
      maxLength,
      pattern,
      uppercase: raw.uppercase === true,
    });
  }

  // The primary `mobile` parameter is mandatory for every ClubAPI call, so it
  // always sorts first.
  return result.sort((a, b) => FIELD_KEYS.indexOf(a.key) - FIELD_KEYS.indexOf(b.key));
}

/** The fields a provider actually uses: its own, else the service defaults. */
export function effectiveFields(serviceKey, providerFields) {
  const own = sanitizeFields(providerFields);
  if (own.some((field) => field.key === 'mobile')) return own;
  return sanitizeFields(SERVICE_DEFINITIONS[serviceKey]?.defaultFields || []);
}

/**
 * Validates and normalises user input against field definitions.
 * @returns {{ values: Record<string,string>, errors: Record<string,string> }}
 */
export function validateFieldValues(fields, input) {
  const values = {};
  const errors = {};
  const source = input && typeof input === 'object' ? input : {};

  for (const field of fields) {
    let value = String(source[field.key] ?? '').trim();
    if (field.inputType === 'mobile' || field.inputType === 'number') {
      value = value.replace(/[\s-]/g, '');
    } else {
      value = value.replace(/\s+/g, '');
    }
    if (field.uppercase) value = value.toUpperCase();

    if (!value) {
      errors[field.key] = `Enter ${field.label.toLowerCase()}`;
      continue;
    }
    if ((field.inputType === 'mobile' || field.inputType === 'number') && !/^\d+$/.test(value)) {
      errors[field.key] = `${field.label} should contain digits only`;
      continue;
    }
    if (field.minLength && value.length < field.minLength) {
      errors[field.key] =
        field.minLength === field.maxLength
          ? `${field.label} must be ${field.minLength} characters`
          : `${field.label} must be at least ${field.minLength} characters`;
      continue;
    }
    if (field.maxLength && value.length > field.maxLength) {
      errors[field.key] = `${field.label} can be at most ${field.maxLength} characters`;
      continue;
    }
    if (field.pattern && !new RegExp(field.pattern).test(value)) {
      errors[field.key] = `Enter a valid ${field.label.toLowerCase()}`;
      continue;
    }
    values[field.key] = value;
  }

  return { values, errors };
}

/* ----------------------------------------------------------------- amounts */

/**
 * Validates a payable amount for a service, optionally narrowed by a fetched
 * bill's exactness rule. Returns the amount rounded to paise, or an error.
 */
export function validateServiceAmount(serviceKey, rawAmount, rule = null) {
  const definition = SERVICE_DEFINITIONS[serviceKey];
  if (!definition) return { error: 'Unknown service' };

  const amount = Math.round(Number(rawAmount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter a valid amount' };
  if (definition.wholeRupees && !Number.isInteger(amount)) {
    return { error: 'Amount must be in whole rupees' };
  }

  const min = Math.max(definition.minAmount, rule?.min ?? definition.minAmount);
  const max = Math.min(definition.maxAmount, rule?.max ?? definition.maxAmount);

  if (rule && rule.editable === false && Math.abs(amount - rule.min) > 0.009) {
    return { error: `This biller accepts only the exact bill amount of ₹${rule.min}` };
  }
  if (amount < min) return { error: `Minimum amount is ₹${min}` };
  if (amount > max) return { error: `Maximum amount is ₹${max}` };

  return { amount };
}

/* ------------------------------------------------------------ classification */

const DTH_PATTERN = /\b(dth|digital\s*tv|dish\s*tv|dishtv|tata\s*(play|sky)|sun\s*direct|d2h|videocon)\b/i;
const MOBILE_PATTERN = /\b(airtel|vodafone|idea|vi|jio|bsnl|mtnl)\b/i;
const NOT_PREPAID_PATTERN =
  /(postpaid|post\s*paid|landline|broadband|fiber|fibre|fastag|money|wallet|payments?\s*bank|credit|insurance|loan|\bgas\b|water|electric|\bdth\b|\btv\b)/i;
const CREDIT_CARD_PATTERN = /credit\s*card|\bcards?\b/i;
// "Fastag", "FASTag", "Fast Tag" and "FastTag" all occur in biller names.
const FASTAG_PATTERN = /fas\s*t?\s*tag|\bnetc\b/i;
const ELECTRICITY_PATTERN =
  /(electric|electricity|power|vidyut|bijli|energy|discom|bses|msedcl|mahavitaran|uppcl|tneb|tangedco|kseb|bescom|mescom|hescom|gescom|cesc|torrent|tata\s*power|adani\s*electricity|jvvnl|avvnl|jdvvnl|pspcl|dhbvn|uhbvn|wbsedcl|apepdcl|apspdcl|tsspdcl|tsnpdcl|mppkvvcl|cspdcl|nbpdcl|sbpdcl|jbvnl|upcl|hpseb|dgvcl|mgvcl|pgvcl|ugvcl|noida\s*power|apdcl|tsecl|mspdcl|nesco|wesco|southco|tpcodl|tpsodl|tpwodl|tpnodl|best\s*undertaking|kedl)/i;
const NOT_ELECTRICITY_PATTERN = /(gas|water|insurance|loan|broadband|fastag|card|lpg|cylinder)/i;

/**
 * Decides which of the five services a ClubAPI operator belongs to, from its
 * name and (when ClubAPI sends one) its category. Returns null for anything
 * outside the five services.
 */
export function classifyOperator({ name = '', category = '', bbpsId = '' } = {}) {
  const text = `${category} ${name}`.trim();
  const hasBbps = Boolean(String(bbpsId || '').trim());

  if (hasBbps) {
    if (FASTAG_PATTERN.test(text)) return 'fastag';
    if (CREDIT_CARD_PATTERN.test(text) && !/loan|insurance/i.test(text)) return 'credit_card';
    if (ELECTRICITY_PATTERN.test(text) && !NOT_ELECTRICITY_PATTERN.test(text)) return 'electricity';
    return null;
  }

  if (DTH_PATTERN.test(text)) return 'dth';
  if (MOBILE_PATTERN.test(name) && !NOT_PREPAID_PATTERN.test(text)) return 'mobile';
  return null;
}

/** Public shape of a service for the app. */
export function publicServiceDefinition(definition) {
  return {
    key: definition.key,
    title: definition.title,
    subtitle: definition.subtitle,
    kind: definition.kind,
    providerLabel: definition.providerLabel,
    minAmount: definition.minAmount,
    maxAmount: definition.maxAmount,
    wholeRupees: definition.wholeRupees,
    supportsPlans: definition.supportsPlans,
    supportsOperatorDetect: definition.supportsOperatorDetect,
  };
}
