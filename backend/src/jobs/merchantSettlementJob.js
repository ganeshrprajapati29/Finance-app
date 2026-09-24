import MerchantLedger from '../models/MerchantLedger.js';
import { processQueuedMerchantPayouts } from '../services/velxapay/payoutService.js';

let timer;
export function startMerchantSettlementJob() {
  if (timer) return timer;
  const run = async () => {
    try {
      await MerchantLedger.updateMany(
        { type: 'COLLECTION_CREDIT', status: 'PENDING', availableOn: { $lte: new Date() } },
        { $set: { status: 'AVAILABLE' } }
      );
      await processQueuedMerchantPayouts();
    } catch (error) { console.error('Merchant settlement availability job failed:', error.message); }
  };
  // DB connection is established asynchronously during boot. The first
  // interval run avoids racing Mongoose while bufferCommands is disabled.
  timer = setInterval(run, 5 * 60 * 1000); timer.unref?.(); return timer;
}
