import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSigncarePennyDrop } from '../src/utils/signcareBankVerification.js';

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
