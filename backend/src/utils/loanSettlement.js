/**
 * Pure loan-schedule settlement rules, kept out of the route so they can be
 * unit-tested without a database.
 *
 * These functions mutate the schedule array in place (Mongoose subdocuments
 * are mutated the same way) and report what changed, so the caller decides
 * when to persist.
 */

/**
 * Applies a confirmed payment to a loan schedule.
 *
 * Rules, in priority order:
 *  - `FULL_REPAYMENT` settles every unpaid installment.
 *  - An explicit `installmentNo` settles only that installment, and only if it
 *    is still unpaid. A repeat event for an already-paid installment is a
 *    no-op; it must never roll forward onto the next EMI, which is how a
 *    duplicate webhook could otherwise credit an installment the customer
 *    never paid for.
 *  - With no installment number, the earliest unpaid installment is settled.
 *
 * @param {Array} schedule loan.schedule (mutated in place)
 * @param {object} payment
 * @param {string} payment.type
 * @param {number|null} [payment.installmentNo]
 * @param {*} payment.paymentId value written to the settled installment
 * @param {Date} [payment.paidAt]
 * @returns {{ settled: number[], alreadySettled: boolean }}
 */
export function applyPaymentToSchedule(schedule, payment) {
  const rows = Array.isArray(schedule) ? schedule : [];
  const paidAt = payment?.paidAt || new Date();
  const settled = [];
  let appliedAmount = 0;

  const rowPaidAmount = (row) => Array.isArray(row?.partPayments)
    ? row.partPayments.reduce((sum, item) => sum + Number(item?.amount || 0), 0)
    : 0;
  const rowOutstanding = (row) => Math.max(0, Number(row?.total || 0) - rowPaidAmount(row));

  const applyToRow = (row, requestedAmount) => {
    const outstanding = rowOutstanding(row);
    if (row?.paid || outstanding <= 0) return false;
    const amount = Math.min(
      outstanding,
      requestedAmount == null ? outstanding : Math.max(0, Number(requestedAmount)),
    );
    if (!(amount > 0)) return false;
    if (amount < outstanding) {
      if (!Array.isArray(row.partPayments)) row.partPayments = [];
      row.partPayments.push({ amount, paymentId: payment?.paymentId, paymentDate: paidAt });
      appliedAmount += amount;
      return true;
    }
    row.paid = true;
    row.paidAt = paidAt;
    row.paymentId = payment?.paymentId;
    appliedAmount += amount;
    settled.push(Number(row.installmentNo));
    return true;
  };

  if (payment?.type === 'FULL_REPAYMENT') {
    for (const row of rows) {
      applyToRow(row);
    }
    return { settled, appliedAmount, alreadySettled: appliedAmount === 0 };
  }

  const installmentNo = payment?.installmentNo;
  if (installmentNo !== null && installmentNo !== undefined && installmentNo !== '') {
    const target = rows.find(
      (row) => Number(row.installmentNo) === Number(installmentNo)
    );
    if (!target) return { settled, alreadySettled: false };
    if (target.paid || rowOutstanding(target) <= 0) return { settled, appliedAmount, alreadySettled: true };
    applyToRow(target, payment?.amount);
    return { settled, appliedAmount, alreadySettled: false };
  }

  // No installment specified: settle the earliest unpaid one by due date, so
  // an unlabelled payment always clears the oldest debt first.
  const pending = rows
    .filter((row) => !row.paid)
    .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));

  if (!pending.length) return { settled, appliedAmount, alreadySettled: true };
  applyToRow(pending[0], payment?.amount);
  return { settled, appliedAmount, alreadySettled: false };
}

/**
 * True when every installment is settled, i.e. the loan should move to CLOSED.
 * An empty schedule is never "fully paid" - a loan with no schedule has not
 * been disbursed yet.
 * @param {Array} schedule
 * @returns {boolean}
 */
export function isScheduleFullyPaid(schedule) {
  const rows = Array.isArray(schedule) ? schedule : [];
  return rows.length > 0 && rows.every((row) => row.paid === true);
}

/**
 * Total still owed on a schedule.
 * @param {Array} schedule
 * @returns {number}
 */
export function outstandingAmount(schedule) {
  const rows = Array.isArray(schedule) ? schedule : [];
  return rows.reduce((sum, row) => {
    if (row.paid) return sum;
    const paid = Array.isArray(row.partPayments)
      ? row.partPayments.reduce((rowSum, item) => rowSum + Number(item?.amount || 0), 0)
      : 0;
    return sum + Math.max(0, Number(row.total || 0) - paid);
  }, 0);
}
