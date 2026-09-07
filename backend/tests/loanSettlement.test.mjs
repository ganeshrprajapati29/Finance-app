/**
 * Settlement rules for loan repayments.
 *
 * Run with:  node --test tests/
 *
 * These cover the behaviour that duplicate Razorpay events used to break:
 * a callback and a webhook both arriving for the same payment must not settle
 * two installments, and the loan must close the moment the last EMI is paid -
 * not only on an explicit foreclosure.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPaymentToSchedule,
  isScheduleFullyPaid,
  outstandingAmount,
} from '../src/utils/loanSettlement.js';

const buildSchedule = (count = 3, total = 1000) =>
  Array.from({ length: count }, (_, i) => ({
    installmentNo: i + 1,
    total,
    dueDate: new Date(2026, i, 5).toISOString(),
    paid: false,
    paidAt: null,
    paymentId: null,
  }));

test('settles the named installment only', () => {
  const schedule = buildSchedule();

  const result = applyPaymentToSchedule(schedule, {
    type: 'REPAYMENT',
    installmentNo: 2,
    paymentId: 'pay_1',
  });

  assert.deepEqual(result.settled, [2]);
  assert.equal(schedule[0].paid, false);
  assert.equal(schedule[1].paid, true);
  assert.equal(schedule[1].paymentId, 'pay_1');
  assert.equal(schedule[2].paid, false);
});

test('a duplicate event for a settled installment is a no-op', () => {
  const schedule = buildSchedule();

  // Callback arrives.
  applyPaymentToSchedule(schedule, {
    type: 'REPAYMENT',
    installmentNo: 1,
    paymentId: 'pay_1',
  });
  // Webhook arrives for the same payment.
  const replay = applyPaymentToSchedule(schedule, {
    type: 'REPAYMENT',
    installmentNo: 1,
    paymentId: 'pay_1',
  });

  assert.equal(replay.alreadySettled, true);
  assert.deepEqual(replay.settled, []);
  // The critical assertion: EMI 2 must NOT have been rolled forward.
  assert.equal(schedule[1].paid, false);
  assert.equal(schedule.filter((row) => row.paid).length, 1);
});

test('an unlabelled payment settles the earliest unpaid installment', () => {
  const schedule = buildSchedule();

  applyPaymentToSchedule(schedule, { type: 'REPAYMENT', paymentId: 'pay_1' });
  assert.equal(schedule[0].paid, true);

  applyPaymentToSchedule(schedule, { type: 'REPAYMENT', paymentId: 'pay_2' });
  assert.equal(schedule[1].paid, true);
  assert.equal(schedule[2].paid, false);
});

test('an unlabelled payment settles by due date, not array order', () => {
  const schedule = buildSchedule();
  // Simulate a schedule stored out of order.
  schedule.reverse();

  applyPaymentToSchedule(schedule, { type: 'REPAYMENT', paymentId: 'pay_1' });

  const settled = schedule.find((row) => row.paid);
  assert.equal(settled.installmentNo, 1, 'oldest debt should clear first');
});

test('full repayment settles every unpaid installment', () => {
  const schedule = buildSchedule(4);
  applyPaymentToSchedule(schedule, {
    type: 'REPAYMENT',
    installmentNo: 1,
    paymentId: 'pay_1',
  });

  const result = applyPaymentToSchedule(schedule, {
    type: 'FULL_REPAYMENT',
    paymentId: 'pay_final',
  });

  assert.deepEqual(result.settled, [2, 3, 4]);
  assert.equal(schedule.every((row) => row.paid), true);
  // The already-paid EMI keeps its original payment reference.
  assert.equal(schedule[0].paymentId, 'pay_1');
});

test('a replayed full repayment settles nothing further', () => {
  const schedule = buildSchedule(3);
  applyPaymentToSchedule(schedule, { type: 'FULL_REPAYMENT', paymentId: 'p1' });
  const replay = applyPaymentToSchedule(schedule, {
    type: 'FULL_REPAYMENT',
    paymentId: 'p1',
  });

  assert.equal(replay.alreadySettled, true);
  assert.deepEqual(replay.settled, []);
});

test('an unknown installment number settles nothing', () => {
  const schedule = buildSchedule();
  const result = applyPaymentToSchedule(schedule, {
    type: 'REPAYMENT',
    installmentNo: 99,
    paymentId: 'pay_x',
  });

  assert.deepEqual(result.settled, []);
  assert.equal(schedule.some((row) => row.paid), false);
});

test('paying the last EMI closes the loan', () => {
  const schedule = buildSchedule(3);

  applyPaymentToSchedule(schedule, { type: 'REPAYMENT', installmentNo: 1, paymentId: 'a' });
  assert.equal(isScheduleFullyPaid(schedule), false);

  applyPaymentToSchedule(schedule, { type: 'REPAYMENT', installmentNo: 2, paymentId: 'b' });
  assert.equal(isScheduleFullyPaid(schedule), false);

  applyPaymentToSchedule(schedule, { type: 'REPAYMENT', installmentNo: 3, paymentId: 'c' });
  assert.equal(isScheduleFullyPaid(schedule), true, 'final EMI must close the loan');
});

test('an empty or missing schedule is never "fully paid"', () => {
  assert.equal(isScheduleFullyPaid([]), false);
  assert.equal(isScheduleFullyPaid(null), false);
  assert.equal(isScheduleFullyPaid(undefined), false);
});

test('outstanding amount tracks unpaid installments', () => {
  const schedule = buildSchedule(3, 1500);
  assert.equal(outstandingAmount(schedule), 4500);

  applyPaymentToSchedule(schedule, { type: 'REPAYMENT', installmentNo: 1, paymentId: 'a' });
  assert.equal(outstandingAmount(schedule), 3000);

  applyPaymentToSchedule(schedule, { type: 'FULL_REPAYMENT', paymentId: 'b' });
  assert.equal(outstandingAmount(schedule), 0);
});

test('null and malformed schedules do not throw', () => {
  assert.doesNotThrow(() => applyPaymentToSchedule(null, { type: 'REPAYMENT' }));
  assert.doesNotThrow(() => applyPaymentToSchedule(undefined, { type: 'REPAYMENT' }));
  assert.doesNotThrow(() => applyPaymentToSchedule([], {}));
  assert.equal(outstandingAmount(null), 0);
});

test('installmentNo of 0 or empty string falls back to earliest unpaid', () => {
  // installmentNo is never 0 in practice, but an empty string arriving from a
  // form-encoded webhook must not be treated as "installment 0".
  const schedule = buildSchedule();
  applyPaymentToSchedule(schedule, {
    type: 'REPAYMENT',
    installmentNo: '',
    paymentId: 'pay_1',
  });
  assert.equal(schedule[0].paid, true);
});
