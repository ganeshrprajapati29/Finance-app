/**
 * ClubAPI response handling and the service catalog rules.
 *
 * Response fixtures are the examples from ClubAPI's own documentation
 * (developer.clubapi.in), so these tests pin the exact envelopes production
 * will see.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  amountRuleForExactness,
  decideTransactionOutcome,
  normalizeBillFetchResponse,
  normalizeMobileSeries,
  normalizeOperatorList,
  normalizePlans,
  normalizeStatusCheckResponse,
  normalizeTransactionResponse,
  toLocalStatus,
} from '../src/services/clubapiResponse.js';
import {
  SERVICE_DEFINITIONS,
  classifyOperator,
  effectiveFields,
  sanitizeFields,
  validateFieldValues,
  validateServiceAmount,
} from '../src/config/serviceCatalog.js';

/* ------------------------------------------------ documented response shapes */

const RECHARGE_PENDING = {
  data: {
    orderId: '1210708',
    status: 'PENDING',
    mobile: '9000000000',
    amount: '100',
    transId: '',
    resCode: '201',
    p2pBuyerBal: '100.23',
    p2aBuyerBal: '98462.0000',
    creditUsed: '98.0000',
    resText: '',
  },
};

const BILL_FETCH_SUCCESS = {
  orderId: '2406091956xxxxx',
  status: 'SUCCESS',
  billData: {
    billFetchStatus: 'SUCCESS',
    billAmount: '1298.00',
    billName: 'Mithun kumar patra',
    billNumber: 'NA',
    dueDate: '2024-06-09',
    billPeriod: 'QUARTERLY',
    billerBalance: '',
    billRemark: '',
    bbpsName: 'Wish Net Pvt Ltd',
    exactness: 'EXACT',
    resText: '',
  },
  resText: ' -',
  pointUsed: '',
  resCode: '',
};

const STATUS_SUCCESS = {
  data: [
    {
      orderId: '172300',
      urid: '60b5f24378fc3',
      operatorId: '1',
      creditused: '10.0000',
      status: 'SUCCESS',
      mobile: '5962823782',
      amount: '10.00',
      transId: 'OPR123',
      transTime: '2021-06-01 14:09:31',
      resCode: '',
      resText: '',
    },
  ],
  resText: '',
};

/* ------------------------------------------------------ transaction status */

test('recharge status is read from the nested data object', () => {
  const parsed = normalizeTransactionResponse(RECHARGE_PENDING);
  assert.equal(parsed.status, 'PENDING');
  assert.equal(parsed.orderId, '1210708');
  assert.equal(toLocalStatus(parsed.status), 'processing');

  const success = normalizeTransactionResponse({ data: { ...RECHARGE_PENDING.data, status: 'SUCCESS', transId: 'T1' } });
  assert.equal(success.status, 'SUCCESS');
  assert.equal(success.operatorTxnId, 'T1');
  assert.equal(toLocalStatus(success.status), 'completed');
});

test('a timeout stays pending and is never refunded', () => {
  const decision = decideTransactionOutcome({ delivery: 'unknown', error: 'timeout of 45000ms exceeded' });
  assert.equal(decision.localStatus, 'processing');
  assert.equal(decision.refund, false);
});

test('a request that never left the server fails and refunds', () => {
  const decision = decideTransactionOutcome({ delivery: 'not_sent', error: 'ClubAPI token is not configured' });
  assert.equal(decision.localStatus, 'failed');
  assert.equal(decision.refund, true);
});

test('explicit statuses map to completed / processing / failed', () => {
  const wrap = (status) => ({ delivery: 'received', httpStatus: 200, data: { data: { orderId: '9', status } } });
  assert.deepEqual(
    [wrap('SUCCESS'), wrap('PENDING'), wrap('FAILED')].map((o) => [decideTransactionOutcome(o).localStatus, decideTransactionOutcome(o).refund]),
    [['completed', false], ['processing', false], ['failed', true]]
  );
});

test('a rejection with an error and no orderId is a definitive failure', () => {
  const decision = decideTransactionOutcome({
    delivery: 'received',
    httpStatus: 200,
    data: { resText: 'Insufficient balance' },
  });
  assert.equal(decision.localStatus, 'failed');
  assert.equal(decision.refund, true);
  assert.equal(decision.message, 'Insufficient balance');
});

test('an empty response with an orderId stays pending for a status check', () => {
  const decision = decideTransactionOutcome({ delivery: 'received', httpStatus: 502, data: { data: { orderId: '55' } } });
  assert.equal(decision.localStatus, 'processing');
  assert.equal(decision.refund, false);
  assert.equal(decision.orderId, '55');
});

/* ---------------------------------------------------------------- bill fetch */

test('bill fetch reads billData and treats NA / " -" as empty', () => {
  const parsed = normalizeBillFetchResponse(BILL_FETCH_SUCCESS);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.bill.customerName, 'Mithun kumar patra');
  assert.equal(parsed.bill.amount, 1298);
  assert.equal(parsed.bill.dueDate, '2024-06-09');
  assert.equal(parsed.bill.billNumber, '', 'NA must not be shown as a bill number');
  assert.equal(parsed.bill.billerName, 'Wish Net Pvt Ltd');
  assert.equal(parsed.bill.exactness, 'EXACT');
  assert.equal(parsed.message, '', '" -" must not be shown as a message');
  assert.deepEqual(
    { editable: parsed.amountRule.editable, min: parsed.amountRule.min, max: parsed.amountRule.max },
    { editable: false, min: 1298, max: 1298 }
  );
});

test('bill fetch failure surfaces the biller reason', () => {
  const parsed = normalizeBillFetchResponse({
    status: 'SUCCESS',
    billData: { billFetchStatus: 'FAILED', resText: 'Invalid consumer number' },
  });
  assert.equal(parsed.ok, false);
  assert.equal(parsed.message, 'Invalid consumer number');

  const topLevel = normalizeBillFetchResponse({ status: 'FAILED', resText: 'Biller not available' });
  assert.equal(topLevel.ok, false);
  assert.equal(topLevel.message, 'Biller not available');
});

test('exactness rules bound the payable amount', () => {
  assert.deepEqual(pick(amountRuleForExactness('EXACT_DOWN', 500)), { editable: true, min: 1, max: 500 });
  assert.deepEqual(pick(amountRuleForExactness('EXACT_UP', 500)), { editable: true, min: 500, max: 100000 });
  assert.deepEqual(pick(amountRuleForExactness('ANY', 500)), { editable: true, min: 1, max: 100000 });
  assert.deepEqual(pick(amountRuleForExactness('ADHOC', 0, { min: 100, max: 5000 })), { editable: true, min: 100, max: 5000 });
  // EXACT with no amount cannot lock the payment to zero.
  assert.equal(amountRuleForExactness('EXACT', 0).editable, true);
});

function pick(rule) {
  return { editable: rule.editable, min: rule.min, max: rule.max };
}

/* ------------------------------------------------------------- status check */

test('status check reads the transaction from data[0]', () => {
  const parsed = normalizeStatusCheckResponse(STATUS_SUCCESS);
  assert.equal(parsed.found, true);
  assert.equal(parsed.status, 'SUCCESS');
  assert.equal(parsed.orderId, '172300');
  assert.equal(parsed.operatorTxnId, 'OPR123');
});

test('status check recognises "No such order found"', () => {
  const parsed = normalizeStatusCheckResponse({ status: 'FAILED', data: [], resText: 'No such order found' });
  assert.equal(parsed.found, false);
  assert.equal(parsed.notFound, true);
});

/* ----------------------------------------------------------- operator data */

test('operator list, plans and mobile series normalise documented shapes', () => {
  const operators = normalizeOperatorList({
    status: 'SUCCESS',
    operatorList: [
      { name: 'Airtel', operatorId: '1', gstMode: 'P2P' },
      { name: 'Bad row' },
    ],
  });
  assert.deepEqual(operators, [{ name: 'Airtel', operatorId: '1', bbpsId: '', category: '' }]);

  const plans = normalizePlans({
    status: 'SUCCESS',
    planData: [
      { type: 'DATA', amount: '202', detail: 'Pack', validity: '30 days', talktime: '0', data: 'NA', stateId: '17', operatorId: '2' },
      { type: 'SPL', amount: '0' },
    ],
  });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].amount, 202);
  assert.equal(plans[0].data, '');

  const series = normalizeMobileSeries({
    status: 'SUCCESS',
    dataList: [{ mobileCode: '7250', stateId: '17', stateName: 'Bihar & Jharkhand', operator: 'Airtel', operatorId: '1' }],
  });
  assert.equal(series.get('7250').operatorId, '1');
  assert.equal(series.get('7250').circle, 'Bihar & Jharkhand');
});

/* --------------------------------------------------------- catalog: fields */

test('credit card defaults ask for registered mobile and last 4 digits', () => {
  const fields = effectiveFields('credit_card', []);
  assert.deepEqual(fields.map((field) => field.key), ['mobile', 'opvalue1']);

  const ok = validateFieldValues(fields, { mobile: '98765 43210', opvalue1: '4321' });
  assert.deepEqual(ok.errors, {});
  assert.deepEqual(ok.values, { mobile: '9876543210', opvalue1: '4321' });

  const bad = validateFieldValues(fields, { mobile: '12345', opvalue1: '43210' });
  assert.ok(bad.errors.mobile);
  assert.ok(bad.errors.opvalue1);
});

test('FASTag vehicle numbers are uppercased and stripped of spaces', () => {
  const fields = effectiveFields('fastag', []);
  const result = validateFieldValues(fields, { mobile: 'mh 12 ab 1234' });
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.mobile, 'MH12AB1234');
});

test('a provider without a mobile field falls back to the service defaults', () => {
  const fields = effectiveFields('electricity', [{ key: 'opvalue1', label: 'Sub division' }]);
  assert.equal(fields[0].key, 'mobile');
});

test('sanitizeFields drops invalid keys, duplicates and broken patterns', () => {
  const fields = sanitizeFields([
    { key: 'opvalue1', label: 'Extra', pattern: '([' },
    { key: 'mobile', label: 'Consumer number' },
    { key: 'mobile', label: 'Duplicate' },
    { key: 'token', label: 'Should never be accepted' },
  ]);
  assert.deepEqual(fields.map((field) => field.key), ['mobile', 'opvalue1']);
  assert.equal(fields[1].pattern, '', 'an invalid regex must be dropped, not crash validation');
});

/* -------------------------------------------------------- catalog: amounts */

test('recharge amounts must be whole rupees within limits', () => {
  assert.equal(validateServiceAmount('mobile', 199).amount, 199);
  assert.ok(validateServiceAmount('mobile', 199.5).error);
  assert.ok(validateServiceAmount('mobile', 5).error);
  assert.ok(validateServiceAmount('dth', SERVICE_DEFINITIONS.dth.maxAmount + 1).error);
});

test('bill amounts respect the fetched bill rule', () => {
  const exact = { editable: false, min: 1298.5, max: 1298.5 };
  assert.equal(validateServiceAmount('electricity', 1298.5, exact).amount, 1298.5);
  assert.ok(validateServiceAmount('electricity', 1000, exact).error, 'EXACT billers cannot be under-paid');

  const down = { editable: true, min: 1, max: 5000 };
  assert.equal(validateServiceAmount('credit_card', 2500.75, down).amount, 2500.75);
  assert.ok(validateServiceAmount('credit_card', 5000.01, down).error);
});

/* ---------------------------------------------------- catalog: classification */

test('ClubAPI operators are classified into the five services', () => {
  assert.equal(classifyOperator({ name: 'Airtel' }), 'mobile');
  assert.equal(classifyOperator({ name: 'Vodafone Idea' }), 'mobile');
  assert.equal(classifyOperator({ name: 'Bsnl Topup' }), 'mobile');
  assert.equal(classifyOperator({ name: 'BSNL STV' }), 'mobile');
  assert.equal(classifyOperator({ name: 'Airtel Digital TV' }), 'dth');
  assert.equal(classifyOperator({ name: 'Tata Play' }), 'dth');
  assert.equal(classifyOperator({ name: 'Dish TV' }), 'dth');
  assert.equal(classifyOperator({ name: 'Airtel Postpaid' }), null);
  assert.equal(classifyOperator({ name: 'Jio Fiber' }), null);

  assert.equal(classifyOperator({ name: 'HDFC Bank Credit Card', bbpsId: 'X1' }), 'credit_card');
  assert.equal(classifyOperator({ name: 'ICICI Bank Fastag', bbpsId: 'X2' }), 'fastag');
  assert.equal(classifyOperator({ name: 'Uttar Pradesh Power Corp Ltd (UPPCL) - URBAN', bbpsId: 'UPPCL0000UTP02' }), 'electricity');
  assert.equal(classifyOperator({ name: 'Adani Gas', bbpsId: 'X3' }), null);
  assert.equal(classifyOperator({ name: 'Wish Net Pvt Ltd', bbpsId: 'WISH' }), null);
  assert.equal(classifyOperator({ name: 'Bajaj Finance Loan', bbpsId: 'X4' }), null);
});
