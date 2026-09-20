/**
 * Pure parsers for ClubAPI responses (https://developer.clubapi.in).
 *
 * ClubAPI does not use one envelope for everything, and the differences are
 * where money bugs hide:
 *
 *   transaction.php (recharge / bill pay)  -> { data: { orderId, status, transId, resText } }
 *   utility/transaction.php billFetch      -> { orderId, status, billData: { billAmount, ... }, resText }
 *   utility/transactionStatus.php          -> { status, data: [ { orderId, status, ... } ], resText }
 *   utility/operatorList.php               -> { status, operatorList: [ { name, operatorId, gstMode } ] }
 *
 * Reading `status` from the wrong level silently turns every successful
 * recharge into "processing", so all envelope handling lives here and is unit
 * tested. Nothing in this file performs I/O.
 */

const clean = (value) => String(value ?? '').replace(/^Exception:\s*/i, '').trim();

/** ClubAPI uses " -" and "NA" as placeholders for "no value". */
const meaningful = (value) => {
  const text = clean(value);
  return text && text !== '-' && text.toUpperCase() !== 'NA' ? text : '';
};

const toNumber = (value) => {
  const number = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(number) ? number : 0;
};

/**
 * Collapses ClubAPI's status vocabulary to SUCCESS / PENDING / FAILED, or
 * UNKNOWN when no status was sent at all (which the docs say must be treated
 * as pending and resolved with a status check, never as a failure).
 */
export function normalizeStatusWord(raw) {
  const value = clean(raw).toUpperCase();
  if (!value) return 'UNKNOWN';
  if (['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'COMPLETE', 'DONE'].includes(value)) return 'SUCCESS';
  if (['PENDING', 'PROCESSING', 'IN_PROCESS', 'INPROCESS', 'ACCEPTED', 'INITIATED'].includes(value)) return 'PENDING';
  if (['FAILED', 'FAILURE', 'FAIL', 'ERROR', 'REJECTED', 'CANCELLED', 'CANCELED', 'REFUNDED', 'REVERSED'].includes(value)) {
    return 'FAILED';
  }
  return 'UNKNOWN';
}

/** Maps a ClubAPI status to the ClubAPITransaction.status enum. */
export function toLocalStatus(status) {
  switch (normalizeStatusWord(status)) {
    case 'SUCCESS':
      return 'completed';
    case 'FAILED':
      return 'failed';
    default:
      return 'processing';
  }
}

/** Picks the object that actually carries the transaction fields. */
function transactionBody(raw) {
  if (!raw || typeof raw !== 'object') return {};
  if (Array.isArray(raw.data)) return raw.data[0] && typeof raw.data[0] === 'object' ? raw.data[0] : {};
  if (raw.data && typeof raw.data === 'object') return raw.data;
  return raw;
}

/**
 * Normalises a recharge or bill-payment response from transaction.php.
 * @returns {{status: string, orderId: string, operatorTxnId: string, message: string, amount: number}}
 */
export function normalizeTransactionResponse(raw) {
  const body = transactionBody(raw);
  const status = normalizeStatusWord(body.status ?? raw?.status);
  return {
    status,
    orderId: meaningful(body.orderId ?? body.order_id ?? raw?.orderId),
    operatorTxnId: meaningful(body.transId ?? body.operatorId_txn ?? body.opTransId),
    message: meaningful(body.resText ?? raw?.resText ?? body.message ?? raw?.message),
    amount: toNumber(body.amount),
  };
}

/**
 * Billers declare how the payable amount may differ from the fetched bill.
 * Returns the bounds the UI shows and the server enforces.
 */
export function amountRuleForExactness(exactness, billAmount, limits = {}) {
  const floor = Number(limits.min ?? 1);
  const ceiling = Number(limits.max ?? 100000);
  const amount = Math.round(toNumber(billAmount) * 100) / 100;
  const mode = clean(exactness).toUpperCase() || (amount > 0 ? 'EXACT' : 'ADHOC');

  switch (mode) {
    case 'EXACT':
      if (amount > 0) return { mode, editable: false, min: amount, max: amount, suggested: amount };
      return { mode: 'ADHOC', editable: true, min: floor, max: ceiling, suggested: null };
    case 'EXACT_DOWN':
      return { mode, editable: true, min: floor, max: amount > 0 ? amount : ceiling, suggested: amount || null };
    case 'EXACT_UP':
      return { mode, editable: true, min: amount > 0 ? Math.max(amount, floor) : floor, max: ceiling, suggested: amount || null };
    case 'ANY':
    case 'ADHOC':
    case 'BOTH':
    default:
      return { mode, editable: true, min: floor, max: ceiling, suggested: amount || null };
  }
}

/**
 * Normalises a billFetch response. `ok` is false whenever either the call or
 * the biller reported a failure, with the biller's own reason in `message`.
 */
export function normalizeBillFetchResponse(raw, limits = {}) {
  const root = raw && typeof raw === 'object' ? raw : {};
  const billData =
    (root.billData && typeof root.billData === 'object' && root.billData) ||
    (root.data && typeof root.data === 'object' && !Array.isArray(root.data) && root.data) ||
    {};

  const callStatus = normalizeStatusWord(root.status);
  const fetchStatusRaw = billData.billFetchStatus;
  const fetchStatus = fetchStatusRaw === undefined ? callStatus : normalizeStatusWord(fetchStatusRaw);
  const message = meaningful(billData.resText) || meaningful(root.resText) || meaningful(root.message);

  const exactness = clean(billData.exactness ?? root.exactness).toUpperCase();
  const amount = toNumber(billData.billAmount ?? billData.amount ?? billData.dueAmount);

  const bill = {
    customerName: meaningful(billData.billName ?? billData.customerName ?? billData.consumerName),
    amount,
    dueDate: meaningful(billData.dueDate ?? billData.billDueDate),
    billDate: meaningful(billData.billDate),
    billNumber: meaningful(billData.billNumber ?? billData.billNo),
    billPeriod: meaningful(billData.billPeriod),
    billerName: meaningful(billData.bbpsName ?? billData.billerName),
    billerBalance: meaningful(billData.billerBalance),
    remarks: meaningful(billData.billRemark),
    exactness: exactness || (amount > 0 ? 'EXACT' : 'ADHOC'),
  };

  const ok = callStatus !== 'FAILED' && fetchStatus === 'SUCCESS';

  return {
    ok,
    status: ok ? 'SUCCESS' : fetchStatus === 'UNKNOWN' ? callStatus : fetchStatus,
    orderId: meaningful(root.orderId),
    message,
    bill,
    amountRule: amountRuleForExactness(bill.exactness, amount, limits),
  };
}

const NOT_FOUND_PATTERN = /no\s+such\s+order|order\s+not\s+found|transaction\s+archived|not\s+found/i;

/**
 * Normalises utility/transactionStatus.php. The top-level `status` only says
 * whether the lookup ran; the transaction's own status is inside `data[0]`.
 */
export function normalizeStatusCheckResponse(raw) {
  const root = raw && typeof raw === 'object' ? raw : {};
  const rows = Array.isArray(root.data) ? root.data : root.data && typeof root.data === 'object' ? [root.data] : [];
  const row = rows[0] && typeof rows[0] === 'object' ? rows[0] : null;
  const message = meaningful(row?.resText) || meaningful(root.resText) || meaningful(root.message);

  if (!row) {
    return {
      found: false,
      notFound: NOT_FOUND_PATTERN.test(meaningful(root.resText) || meaningful(root.message)),
      status: 'UNKNOWN',
      orderId: '',
      operatorTxnId: '',
      message,
    };
  }

  return {
    found: true,
    notFound: false,
    status: normalizeStatusWord(row.status),
    orderId: meaningful(row.orderId),
    operatorTxnId: meaningful(row.transId),
    message,
  };
}

/** Normalises operatorList.php into `{ name, operatorId, bbpsId, category }` rows. */
export function normalizeOperatorList(raw) {
  const root = raw && typeof raw === 'object' ? raw : {};
  const list = Array.isArray(root.operatorList)
    ? root.operatorList
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.data?.operatorList)
        ? root.data.operatorList
        : [];

  return list
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      name: clean(row.name ?? row.operatorName ?? row.operator),
      operatorId: clean(row.operatorId ?? row.id ?? row.opId),
      bbpsId: clean(row.bbpsId ?? row.bbps_id ?? row.billerId),
      category: clean(row.category ?? row.service ?? row.serviceType ?? row.type),
    }))
    .filter((row) => row.name && (row.operatorId || row.bbpsId));
}

/** Normalises mobilePlan rows. */
export function normalizePlans(raw) {
  const root = raw && typeof raw === 'object' ? raw : {};
  const rows = Array.isArray(root.planData) ? root.planData : Array.isArray(root.data) ? root.data : [];
  return rows
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      type: clean(row.type).toUpperCase() || 'OTHER',
      amount: toNumber(row.amount),
      detail: meaningful(row.detail),
      validity: meaningful(row.validity),
      talktime: meaningful(row.talktime),
      data: meaningful(row.data),
      stateId: clean(row.stateId),
      operatorId: clean(row.operatorId),
    }))
    .filter((row) => row.amount > 0);
}

/** Normalises mobileDetails rows keyed by the 4-digit mobile series. */
export function normalizeMobileSeries(raw) {
  const root = raw && typeof raw === 'object' ? raw : {};
  const rows = Array.isArray(root.dataList) ? root.dataList : Array.isArray(root.data) ? root.data : [];
  const series = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const code = clean(row.mobileCode);
    if (!/^\d{4}$/.test(code)) continue;
    series.set(code, {
      operatorId: clean(row.operatorId),
      operatorName: clean(row.operator),
      stateId: clean(row.stateId),
      circle: clean(row.stateName),
    });
  }
  return series;
}

/**
 * Decides what a recharge / bill-payment call means for the customer.
 *
 * The rules follow ClubAPI's documentation:
 *  - no response (timeout, reset) is PENDING, never a failure;
 *  - a request that never left our server, or that ClubAPI rejected without
 *    creating an order, is a definitive failure and is refunded;
 *  - otherwise the transaction's own status decides.
 *
 * @param {{delivery: string, httpStatus?: number, data?: any, error?: string}} outcome
 * @returns {{localStatus: 'completed'|'processing'|'failed', refund: boolean, orderId: string, operatorTxnId: string, message: string}}
 */
export function decideTransactionOutcome(outcome = {}) {
  if (outcome.delivery === 'not_sent') {
    return {
      localStatus: 'failed',
      refund: true,
      orderId: '',
      operatorTxnId: '',
      message: clean(outcome.error) || 'Service provider is not reachable',
    };
  }

  if (outcome.delivery !== 'received') {
    return {
      localStatus: 'processing',
      refund: false,
      orderId: '',
      operatorTxnId: '',
      message: 'Awaiting confirmation from the operator',
    };
  }

  const parsed = normalizeTransactionResponse(outcome.data);
  const base = { orderId: parsed.orderId, operatorTxnId: parsed.operatorTxnId, message: parsed.message };

  if (parsed.status === 'SUCCESS') return { ...base, localStatus: 'completed', refund: false };
  if (parsed.status === 'FAILED') return { ...base, localStatus: 'failed', refund: true };
  if (parsed.status === 'PENDING') return { ...base, localStatus: 'processing', refund: false };

  // No status at all. Every order ClubAPI accepts gets an orderId, so an
  // explicit error with no orderId means the request was rejected outright.
  if (!parsed.orderId && parsed.message) {
    return { ...base, localStatus: 'failed', refund: true };
  }
  return { ...base, localStatus: 'processing', refund: false };
}

/**
 * Normalises utility/balance.php:
 *   { status, balance: { buyer: { buyer_p2a, buyer_p2p, buyer_total } }, resText }
 * Used by the admin health check - a working balance call proves the token is
 * valid and the server's IP is whitelisted at ClubAPI.
 */
export function normalizeBalanceResponse(raw) {
  const root = raw && typeof raw === 'object' ? raw : {};
  const buyer = root.balance?.buyer && typeof root.balance.buyer === 'object' ? root.balance.buyer : {};
  const status = normalizeStatusWord(root.status);
  const hasBalance = buyer.buyer_total !== undefined || buyer.buyer_p2a !== undefined || buyer.buyer_p2p !== undefined;
  return {
    ok: status === 'SUCCESS' || (status === 'UNKNOWN' && hasBalance),
    message: meaningful(root.resText) || meaningful(root.message),
    total: toNumber(buyer.buyer_total),
    p2a: toNumber(buyer.buyer_p2a),
    p2p: toNumber(buyer.buyer_p2p),
  };
}
