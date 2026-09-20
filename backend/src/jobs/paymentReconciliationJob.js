import MerchantPayment from '../models/MerchantPayment.js';
import { verifyMerchantPayin } from '../services/velxapay/payinService.js';
import { creditMerchantCollection } from '../services/velxapay/webhookService.js';

let timer;
export function startMerchantPaymentReconciliationJob() {
  if (timer) return timer;
  const run = async () => {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000);
    const rows = await MerchantPayment.find({ status: 'PENDING', updatedAt: { $lte: cutoff } }).sort({ updatedAt: 1 }).limit(25);
    for (const payment of rows) {
      try {
        const raw = await verifyMerchantPayin(payment.orderId);
        const status = String(raw?.data?.payment_status || raw?.payment_status || '').toLowerCase();
        if (status === 'success') {
          await creditMerchantCollection({ orderId: payment.orderId, amount: raw?.data?.amount ?? raw?.data?.orderAmount ?? payment.amount, utr: raw?.data?.utr ?? raw?.utr, provider: { reconciliation: raw } });
        } else if (status === 'failed') { payment.status = 'FAILED'; payment.failedAt = new Date(); await payment.save(); }
      } catch (error) { console.error(`Merchant payment reconciliation failed (${payment.orderId}):`, error.message); }
    }
  };
  timer = setInterval(() => run().catch((error) => console.error('Merchant reconciliation job failed:', error.message)), 3 * 60 * 1000);
  timer.unref?.(); return timer;
}
