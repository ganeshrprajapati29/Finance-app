import axios from 'axios';
import { assertVelxapayConfigured, velxapayConfig } from '../../config/velxapay.js';

export async function velxapayPost(url, payload) {
  assertVelxapayConfigured();
  try {
    const response = await axios.post(url, payload, {
      timeout: 25000,
      headers: { 'x-api-key': velxapayConfig.signingKey, 'Content-Type': 'application/json' },
    });
    return response.data;
  } catch (error) {
    const providerMessage = error.response?.data?.message;
    const wrapped = new Error(providerMessage || 'Payment provider is temporarily unavailable.');
    wrapped.status = 502;
    wrapped.code = 'VELXAPAY_REQUEST_FAILED';
    wrapped.providerStatus = error.response?.status;
    throw wrapped;
  }
}
