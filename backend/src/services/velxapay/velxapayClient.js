import axios from 'axios';
import { assertVelxapayConfigured, velxapayConfig } from '../../config/velxapay.js';

export async function velxapayPost(url, payload) {
  assertVelxapayConfigured();
  try {
    const headers = { 'x-api-key': velxapayConfig.signingKey, 'Content-Type': 'application/json' };
    if (velxapayConfig.linkKey) headers['x-link-key'] = velxapayConfig.linkKey;
    const response = await axios.post(url, payload, {
      timeout: 25000,
      headers,
    });
    return response.data;
  } catch (error) {
    const providerBody = error.response?.data;
    const providerMessage = providerBody?.message || providerBody?.error || providerBody?.resText || providerBody?.description;
    const wrapped = new Error(providerMessage || 'Payment provider is temporarily unavailable.');
    wrapped.status = 502;
    wrapped.code = 'VELXAPAY_REQUEST_FAILED';
    wrapped.providerStatus = error.response?.status;
    wrapped.data = providerBody || null;
    throw wrapped;
  }
}
