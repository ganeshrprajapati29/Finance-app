const clean = (value) => String(value || '').trim();

export const velxapayConfig = Object.freeze({
  signingKey: clean(process.env.VELXAPAY_SIGNING_KEY),
  linkKey: clean(process.env.VELXAPAY_LINK_KEY),
  webhookSecret: clean(process.env.VELXAPAY_WEBHOOK_SECRET),
  payinUrl: clean(process.env.VELXAPAY_PAYIN_URL) || 'https://velxapay.com/v2/payment/initiate',
  verifyUrl: clean(process.env.VELXAPAY_VERIFY_URL) || 'https://velxapay.com/v2/payment/verify',
  payoutUrl: clean(process.env.VELXAPAY_PAYOUT_URL) || 'https://velxapay.com/v2/amount/withdraw',
  publicPayBaseUrl: clean(process.env.MERCHANT_PAY_PUBLIC_URL) || 'https://khatupay.com/pay/merchant',
  returnUrl: clean(process.env.VELXAPAY_RETURN_URL) ||
    clean(process.env.RAZORPAY_SUCCESS_URL) ||
    `${clean(process.env.APP_BASE_URL) || 'https://khatupay.com'}/payment-success`,
});

export function assertVelxapayConfigured({ webhook = false } = {}) {
  const missing = [];
  if (!velxapayConfig.signingKey) missing.push('VELXAPAY_SIGNING_KEY');
  if (webhook && !velxapayConfig.webhookSecret) missing.push('VELXAPAY_WEBHOOK_SECRET');
  if (missing.length) {
    const error = new Error(`Missing payment configuration: ${missing.join(', ')}`);
    error.status = 503;
    error.code = 'VELXAPAY_NOT_CONFIGURED';
    throw error;
  }
}
