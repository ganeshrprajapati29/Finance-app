import Loan from '../models/Loan.js';
import { syncAgreementSignature } from '../services/loanAgreementSigning.js';

const INTERVAL_MS = 10 * 60 * 1000;
const STALE_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000;

// Borrowers often close the app right after signing, so SIGNED must not depend
// on them pressing "refresh". This picks up every agreement still being signed.
export async function syncPendingAgreements({ limit = 25 } = {}) {
  const now = Date.now();
  const rows = await Loan.find({
    status: 'APPROVED',
    $or: [
      {
        'agreement.status': 'SIGNING',
        'agreement.signingStartedAt': { $gte: new Date(now - MAX_AGE_MS) },
        $or: [
          { 'agreement.lastSyncedAt': { $exists: false } },
          { 'agreement.lastSyncedAt': null },
          { 'agreement.lastSyncedAt': { $lt: new Date(now - STALE_MS) } },
        ],
      },
      // Loans signed before loan.agreement existed.
      { agreement: { $exists: false }, 'decision.agreementStatus': 'PENDING_SIGNATURE', 'decision.agreementDocumentId': { $nin: [null, ''] } },
    ],
  }).sort({ updatedAt: 1 }).limit(limit);

  let signed = 0;
  for (const loan of rows) {
    try {
      const result = await syncAgreementSignature(loan);
      if (result.status === 'SIGNED') signed += 1;
    } catch (error) {
      console.error('[Agreement sync job]', { loanId: String(loan._id), message: error.message });
    }
  }
  return { checked: rows.length, signed };
}

let timer;
export function startAgreementSignatureSyncJob() {
  if (timer) return timer;
  timer = setInterval(() => {
    syncPendingAgreements().catch((error) => console.error('Agreement signature sync job failed:', error.message));
  }, INTERVAL_MS);
  timer.unref?.();
  return timer;
}
