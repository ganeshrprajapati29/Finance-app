import crypto from 'crypto';
import { velxapayConfig } from '../../config/velxapay.js';
import { velxapayPost } from './velxapayClient.js';

export const makeMerchantOrderId = () => `KPM${Date.now()}${crypto.randomInt(1000, 9999)}`;

export async function initiateMerchantPayin({ orderId, amount, email, phone, firstName, lastName }) {
  const raw = await velxapayPost(velxapayConfig.payinUrl, {
    orderAmount: Number(amount), orderId, email, phone, firstName, lastName,
    redirect: `${velxapayConfig.publicPayBaseUrl}/result?orderId=${encodeURIComponent(orderId)}`,
  });
  const data = raw?.data || raw;
  const checkoutUrl = data?.payment_url || data?.paymentUrl || data?.checkout_url || data?.checkoutUrl || data?.url;
  if (!checkoutUrl) {
    const error = new Error('The payment provider did not return a checkout link.');
    error.status = 502;
    error.code = 'VELXAPAY_INVALID_RESPONSE';
    throw error;
  }
  return { checkoutUrl, provider: raw };
}

export async function verifyMerchantPayin(orderId) {
  return velxapayPost(velxapayConfig.verifyUrl, { order_id: orderId });
}
