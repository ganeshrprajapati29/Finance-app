import { normalizeAadhaarKycData } from './aadhaarKyc.js';
import { normalizePanKycData } from './panKyc.js';

export const EXPERIAN_PROVIDER = 'SIGNCARE_EXPERIAN_RETAIL';

// Every bureau pull is a paid SignCare call (8.9-25 credits), so a report that
// was already fetched for the same identity is reused instead of re-bought.
export const CREDIT_VERIFIED_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CREDIT_REVIEW_TTL_MS = 24 * 60 * 60 * 1000;
// Longer than SignCare's own 60s timeout, so a PENDING row that old is a crash
// leftover, not a call that is still running.
export const CREDIT_PENDING_STALE_MS = 3 * 60 * 1000;

function asNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function amount(value) {
  if (value === null || value === undefined) return 0;
  const n = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function text(value) {
  return String(value ?? '').trim();
}

function validDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '';
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Normalises the date shapes KYC providers and Experian use (DD-MM-YYYY,
 * DD/MM/YYYY, YYYY-MM-DD, YYYYMMDD, DDMMYYYY) to YYYY-MM-DD. Returns '' when
 * the value is not a real calendar date.
 */
export function toIsoDate(value) {
  const raw = text(value);
  if (!raw) return '';
  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[T\s])/);
  if (match) return validDate(match[1], match[2], match[3]);
  match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) return validDate(match[3], match[2], match[1]);
  match = raw.match(/^(\d{8})$/);
  if (match) {
    const digits = match[1];
    return validDate(digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)) ||
      validDate(digits.slice(4, 8), digits.slice(2, 4), digits.slice(0, 2));
  }
  return '';
}

function splitName(fullName) {
  const parts = text(fullName).replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  // Bureau records are keyed on first name + surname, so a middle name is
  // dropped rather than folded into the surname ("RAM KUMAR SHARMA" -> RAM / SHARMA).
  return { firstName: parts[0], lastName: parts.length > 1 ? parts[parts.length - 1] : parts[0] };
}

function findDeep(source, keys, depth = 4) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const visit = (value, level) => {
    if (level > depth || !value || typeof value !== 'object') return '';
    for (const [key, child] of Object.entries(value)) {
      if (wanted.has(key.toLowerCase()) && ['string', 'number'].includes(typeof child) && text(child)) return text(child);
    }
    for (const child of Object.values(value)) {
      const found = visit(child, level + 1);
      if (found) return found;
    }
    return '';
  };
  return visit(source, 0);
}

function validPincode(value) {
  const digits = text(value).replace(/\D/g, '');
  return /^[1-9]\d{5}$/.test(digits) ? digits : '';
}

function pincodeFromText(value) {
  const matches = text(value).match(/\b[1-9]\d{5}\b/g);
  return matches ? matches[matches.length - 1] : '';
}

const FIELD_LABELS = {
  phoneNumber: 'mobile number',
  pan: 'PAN',
  firstName: 'name',
  dateOfBirth: 'date of birth',
  pincode: 'PIN code',
};

/**
 * Builds the SignCare /CreditBureau body from what KYC already captured.
 * `missing` names every field that could not be resolved so the caller can
 * ask the user to redo that KYC step instead of spending a paid call on a
 * request the provider will reject.
 */
export function buildExperianRetailRequest({ user = {}, verification = {} } = {}) {
  const kyc = asObject(user.kyc);
  const panProfile = normalizePanKycData(
    verification.pan?.data || kyc.panData || {},
    { panNumber: kyc.panNumber, name: kyc.panName },
  );
  const aadhaarStored = verification.aadhaar?.data || kyc.aadhaarData || {};
  const aadhaar = normalizeAadhaarKycData(aadhaarStored, asObject(kyc.aadhaarData));

  const fullName = [panProfile.name, kyc.panName, aadhaar.fullName, user.name].map(text).find(Boolean) || '';
  const explicitFirst = text(panProfile.firstName);
  const explicitLast = text(panProfile.lastName);
  const fallbackNames = splitName(fullName);
  const firstName = explicitFirst && explicitLast ? explicitFirst : fallbackNames.firstName;
  const lastName = explicitFirst && explicitLast ? explicitLast : fallbackNames.lastName;

  const pincode = [
    validPincode(aadhaar.pincode),
    validPincode(findDeep(aadhaarStored, ['pincode', 'pinCode', 'pc', 'zip', 'postalCode'])),
    pincodeFromText(aadhaar.address),
    validPincode(user.address?.pincode),
  ].find(Boolean) || '';

  const dateOfBirth = [aadhaar.dob, panProfile.dob, kyc.aadhaarData?.dob, user.dob, user.dateOfBirth]
    .map(toIsoDate).find(Boolean) || '';

  const request = {
    phoneNumber: text(user.mobile).replace(/\D/g, '').slice(-10),
    pan: text(kyc.panNumber || panProfile.panNumber).toUpperCase(),
    firstName,
    lastName,
    dateOfBirth,
    pincode,
  };

  const valid = {
    phoneNumber: /^[6-9]\d{9}$/.test(request.phoneNumber),
    pan: /^[A-Z]{5}\d{4}[A-Z]$/.test(request.pan),
    firstName: Boolean(request.firstName && request.lastName),
    dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(request.dateOfBirth),
    pincode: /^[1-9]\d{5}$/.test(request.pincode),
  };
  const missing = Object.keys(valid).filter((key) => !valid[key]);

  return {
    request: {
      ...request,
      phoneNumber: Number(request.phoneNumber) || 0,
      pincode: Number(request.pincode) || 0,
    },
    missing,
    missingLabels: missing.map((key) => FIELD_LABELS[key]),
  };
}

export function sameBureauIdentity(a = {}, b = {}) {
  // PAN + DOB + PIN + mobile identify the person to the bureau. Names are left out on
  // purpose: how a name is split into first/last is presentation, and comparing it would
  // make a formatting change re-buy reports that are already on file.
  const fields = ['pan', 'dateOfBirth', 'pincode', 'phoneNumber'];
  return fields.every((field) => text(a?.[field]).toUpperCase() === text(b?.[field]).toUpperCase());
}

/**
 * True when an already-stored credit stage can answer this request without a
 * new paid provider call.
 */
export function reusableCreditStage(stage = {}, request = {}, now = Date.now()) {
  const status = text(stage?.status).toUpperCase();
  const stamp = new Date(stage?.verifiedAt || stage?.updatedAt || 0).getTime();
  if (!stamp || !['VERIFIED', 'REVIEW'].includes(status)) return false;
  if (!sameBureauIdentity(stage?.data?.request, request)) return false;
  const age = now - stamp;
  if (status === 'VERIFIED') {
    return age >= 0 && age < CREDIT_VERIFIED_TTL_MS && Boolean(stage?.data?.summary?.hasJsonReport);
  }
  return age >= 0 && age < CREDIT_REVIEW_TTL_MS;
}

export function bureauScore(value) {
  const n = asNumber(value);
  return n !== null && n >= 300 && n <= 900 ? n : null;
}

export function scoreBand(score) {
  if (score === null || score === undefined) return '';
  if (score >= 750) return 'Excellent';
  if (score >= 700) return 'Good';
  if (score >= 650) return 'Fair';
  return 'Low';
}

/** Experian dates arrive as YYYYMMDD integers; 0 / '' means "not reported". */
export function bureauDate(value) {
  const iso = toIsoDate(value);
  return iso || '';
}

const CLOSED_STATUS = /closed|settled|written[\s-]*off/i;

export function isClosedAccount(account = {}) {
  return Boolean(account.date_Closed) || CLOSED_STATUS.test(text(account.accountStatusDescription));
}

function monthsBetween(fromIso, now) {
  const parts = text(fromIso).split('-').map(Number);
  if (parts.length !== 3 || !parts[0]) return null;
  return (now.getUTCFullYear() - parts[0]) * 12 + (now.getUTCMonth() + 1 - parts[1]);
}

function maxDaysPastDue(account, now, windowMonths) {
  let worst = 0;
  for (const entry of asArray(account.caiS_Account_History)) {
    const year = asNumber(entry?.year);
    const month = asNumber(entry?.month);
    if (!year || !month) continue;
    const age = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - month);
    if (age < 0 || age >= windowMonths) continue;
    worst = Math.max(worst, asNumber(entry.days_Past_Due, 0) || 0);
  }
  return worst;
}

export function isSevereAccount(account = {}) {
  const wording = [
    account.writtenOffSettledStatusDescription,
    account.suitfiledwillfuldefaultwrittenoffstatusDescription,
    account.suitfiledWillfuldefaultDescription,
  ].map(text).join(' ')
    .replace(/\bno\s+suit\s*filed\b/gi, '')
    .replace(/\bnot\s+(?:written|settled)\b/gi, '');
  return amount(account.written_Off_Amt_Total) > 0 ||
    amount(account.written_Off_Amt_Principal) > 0 ||
    /written[\s-]*off|wilful|willful|suit\s*filed|settled/i.test(wording);
}

function analyseAccounts(accounts, now) {
  const open = accounts.filter((item) => !isClosedAccount(item));
  const opened = accounts.map((item) => bureauDate(item.open_Date)).filter(Boolean).sort();
  const creditAge = opened.length ? monthsBetween(opened[0], now) : null;
  return {
    accountCount: accounts.length,
    activeAccounts: open.filter((item) => amount(item.current_Balance) > 0).length,
    closedAccounts: accounts.length - open.length,
    outstandingBalance: accounts.reduce((sum, item) => sum + amount(item.current_Balance), 0),
    overdueAmount: accounts.reduce((sum, item) => sum + amount(item.amount_Past_Due), 0),
    delinquentAccounts: open.filter((item) => amount(item.amount_Past_Due) > 0 || maxDaysPastDue(item, now, 3) > 0).length,
    writtenOffAccounts: accounts.filter(isSevereAccount).length,
    maxDaysPastDue12m: accounts.reduce((worst, item) => Math.max(worst, maxDaysPastDue(item, now, 12)), 0),
    creditAgeMonths: creditAge !== null && creditAge >= 0 ? creditAge : null,
  };
}

export function normalizeSigncareExperianRetail(response = {}, request = {}, now = new Date()) {
  const data = response?.data && typeof response.data === 'object' ? response.data : response;
  const report = asObject(data.jsonExperianReport || data.experianReport);
  const accounts = asArray(report.caiS_Account?.caiS_Account_DETAILS);
  const score = bureauScore(
    report.score?.fcirexScore ?? data.score?.fcirexScore ?? (typeof data.score === 'number' ? data.score : null),
  );
  const caps = asObject(report.totalCAPS_Summary);
  const holder = asObject(asArray(accounts[0]?.caiS_Holder_Details)[0]);

  const summary = {
    provider: EXPERIAN_PROVIDER,
    bureau: 'Experian',
    environment: 'production',
    statusCode: response?.statusCode ?? data.statusCode ?? null,
    success: response?.success ?? data.success ?? null,
    // SignCare can answer success:true with a contradictory "could not be
    // completed" message while still returning the report, so this text is
    // kept for admins but never decides the outcome.
    message: text(response?.message || data.message),
    requestId: response?.request_id || response?.requestId || request.requestId || '',
    score,
    scoreBand: scoreBand(score),
    scoreConfidence: text(report.score?.fcirexScoreConfidLevel || data.score?.fcirexScoreConfidLevel),
    reportNumber: text(report.creditProfileHeader?.reportNumber),
    reportDate: bureauDate(report.creditProfileHeader?.reportDate),
    exactMatch: text(report.match_result?.exact_match),
    bureauName: [holder.first_Name_Non_Normalized, holder.surname_Non_Normalized].map(text).filter(Boolean).join(' '),
    ...analyseAccounts(accounts, now),
    inquiries30Days: asNumber(caps.totalCAPSLast30Days, null),
    inquiries: {
      last7Days: asNumber(caps.totalCAPSLast7Days, null),
      last30Days: asNumber(caps.totalCAPSLast30Days, null),
      last90Days: asNumber(caps.totalCAPSLast90Days, null),
      last180Days: asNumber(caps.totalCAPSLast180Days, null),
    },
    hasJsonReport: Object.keys(report).length > 0,
    hasExcelReport: Boolean(data.excelExperianReport),
  };

  // `experianReport` was only ever an alias of `jsonExperianReport`; keeping both
  // doubled the stored size of the largest field for no reader's benefit.
  const { experianReport: _alias, ...rest } = data;
  return {
    ...rest,
    provider: summary.provider,
    bureau: summary.bureau,
    request,
    summary,
    jsonExperianReport: report,
    excelExperianReport: text(data.excelExperianReport),
  };
}

/**
 * A bureau "hit" needs evidence Experian actually matched the customer: a
 * report number, a score, or at least one tradeline. An empty skeleton is a
 * review case, not a verified report.
 */
export function experianRetailVerified(normalized = {}) {
  const summary = normalized.summary || {};
  const hasScore = summary.score !== null && summary.score !== undefined;
  return Boolean(summary.hasJsonReport && (summary.reportNumber || hasScore || summary.accountCount > 0));
}

export function experianStageMessage(verified) {
  return verified
    ? 'Credit report fetched successfully.'
    : 'We could not find a credit history for you. Our credit team will review your application.';
}

/** Splits the bulky base64 workbook away from the report kept on the loan record. */
export function detachExcelReport(normalized = {}) {
  const { excelExperianReport = '', ...lean } = normalized;
  return { lean, excel: excelExperianReport };
}

/**
 * Drops the bulky base64 workbook from a stored/archived report (list payloads only
 * need to know it exists; admins download it on demand).
 */
export function withoutWorkbook(response) {
  if (!response || typeof response !== 'object' || !('excelExperianReport' in response)) return response;
  const { excelExperianReport, ...rest } = response;
  return { ...rest, summary: { ...(rest.summary || {}), hasExcelReport: Boolean(excelExperianReport) } };
}

/** Same, applied to a LoanVerification row's credit stage (older rows still carry the workbook). */
export function verificationWithoutWorkbook(verification) {
  const data = verification?.credit?.data;
  if (!data || !('excelExperianReport' in data)) return verification;
  return { ...verification, credit: { ...verification.credit, data: withoutWorkbook(data) } };
}

/** Returns the .xlsx bytes, or null when the value is not a real workbook. */
export function decodeExperianExcel(value) {
  const clean = text(value).replace(/^data:[^;]+;base64,/i, '').replace(/\s/g, '');
  if (!clean) return null;
  const buffer = Buffer.from(clean, 'base64');
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b ? buffer : null;
}
