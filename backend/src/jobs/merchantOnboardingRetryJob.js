import MerchantBusiness from '../models/MerchantBusiness.js';
import User from '../models/User.js';
import { submitProviderOnboarding } from '../services/merchantOnboarding.js';

const INTERVAL_MS = 6 * 60 * 60 * 1000;

// Business applications queued while Razorpay access was unavailable are sent
// automatically once the provider accepts them, so owners never re-apply.
export async function retryQueuedMerchantOnboarding({ limit = 10 } = {}) {
  const rows = await MerchantBusiness.find({
    onboardingRequest: { $exists: true, $ne: null },
    'razorpay.productId': { $in: [null, ''] },
    status: { $nin: ['REJECTED', 'SUSPENDED'] },
  }).sort({ updatedAt: 1 }).limit(limit);
  let submitted = 0;
  for (const business of rows) {
    try {
      const user = await User.findById(business.userId).select('name email mobile kyc');
      const result = await submitProviderOnboarding(business, user);
      if (!result.queued) submitted += 1;
      // Provider access is account-wide: if one is refused, the rest will be too.
      else break;
    } catch (error) {
      console.error('[merchant-onboarding retry]', { business: business.publicId, message: error.message });
    }
  }
  return { checked: rows.length, submitted };
}

let timer;
export function startMerchantOnboardingRetryJob() {
  if (timer) return timer;
  timer = setInterval(() => {
    retryQueuedMerchantOnboarding().catch((error) => console.error('Merchant onboarding retry job failed:', error.message));
  }, INTERVAL_MS);
  timer.unref?.();
  return timer;
}
