import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSigncarePennyDrop } from '../src/utils/signcareBankVerification.js';
import {
  buildBankAccountVerifyPayload,
  buildCorporateBankStatementPayload,
  buildBankStatementDetailsPayload,
} from '../src/services/signcare.js';

test('Bank account verify payload matches SignCare contract keys', () => {
  const payload = buildBankAccountVerifyPayload({
    accountNumber: '12345678901',
    ifscCode: 'Sbin0001234',
  });

  assert.deepEqual(payload, {
    accountNumber: '12345678901',
    ifsc: 'SBIN0001234',
  });
});

test('Bank statement analyser payload uses SignCare key names exactly', () => {
  const payload = buildCorporateBankStatementPayload({
    fileBase64: 'data:application/pdf;base64,abcd1234',
    password: 'secret123',
    accountType: 'salaried',
    consentText: 'Consent text',
    requestId: 'KP-BSA-123',
    webhookUrl: 'https://example.com/hook',
  });

  assert.deepEqual(payload, {
    consent: 'Y',
    consent_text: 'Consent text',
    request_id: 'KP-BSA-123',
    file_base64: 'abcd1234',
    password: 'secret123',
    webhookUrl: 'https://example.com/hook',
    accountType: 'SALARIED',
  });
});

test('Bank statement detail payload uses SignCare detail keys exactly', () => {
  const payload = buildBankStatementDetailsPayload({
    orderId: 'ORDER-42',
    consentText: 'Consent text',
    requestId: 'KP-BSA-STATUS-1',
  });

  assert.deepEqual(payload, {
    consent: 'Y',
    consent_text: 'Consent text',
    request_id: 'KP-BSA-STATUS-1',
    order_id: 'ORDER-42',
    response_type: 'json',
  });
});

test('SignCare Penny Drop Basic success response verifies the account', () => {
  const parsed = normalizeSigncarePennyDrop({
    data: {
      bankResponse: 'Transaction Successful',
      accountName: 'MR. PARAS NATH PRAJAPATI',
      accountNumber: '10748172578',
      ifsc: 'SBIN0000086',
      bankTxnStatus: true,
    },
    messages: [],
    request_id: '4cf617af-0aeb-417c-b4b3-cf95393954d0',
    success: true,
    statusCode: 101,
    message: 'Valid Authentication',
  });

  assert.equal(parsed.isValid, true);
  assert.equal(parsed.status, 'VERIFIED');
  assert.equal(parsed.accountName, 'MR. PARAS NATH PRAJAPATI');
  assert.equal(parsed.ifscCode, 'SBIN0000086');
  assert.equal(parsed.bankTxnStatus, true);
  assert.equal(parsed.requestId, '4cf617af-0aeb-417c-b4b3-cf95393954d0');
});

test('SignCare Penny Drop Basic failed bank transaction blocks verification', () => {
  const parsed = normalizeSigncarePennyDrop({
    data: {
      bankResponse: 'Invalid Account',
      accountNumber: '10748172578',
      ifsc: 'SBIN0000086',
      bankTxnStatus: false,
    },
    success: true,
    statusCode: 101,
  });

  assert.equal(parsed.isValid, false);
  assert.equal(parsed.status, 'FAILED');
});

test('SignCare Penny Drop Basic accepts success text without boolean bankTxnStatus', () => {
  const parsed = normalizeSigncarePennyDrop({
    data: {
      bankResponse: 'Transaction Successful',
      account_name: 'MR. PARAS NATH PRAJAPATI',
      account_number: '36379036279',
      ifsc_code: 'SBIN0015007',
    },
    success: true,
    statusCode: 100,
    message: 'Valid Authentication',
  });

  assert.equal(parsed.isValid, true);
  assert.equal(parsed.status, 'VERIFIED');
  assert.equal(parsed.accountName, 'MR. PARAS NATH PRAJAPATI');
  assert.equal(parsed.bankTxnStatus, true);
});
