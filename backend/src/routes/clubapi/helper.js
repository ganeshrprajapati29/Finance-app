import crypto from 'crypto';

export function generateURID() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `KPR${stamp}${rand}`.slice(0, 20);
}

export function validateResponse(response) {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response from ClubAPI');
  }

  if (response.status === 'FAILED' || response.status === 'ERROR') {
    throw new Error(response.message || 'Transaction failed');
  }

  const message = String(response.message || response.resText || '');
  if (!response.status && /unauthori[sz]ed|invalid|failed|error|not active/i.test(message)) {
    throw new Error(message || 'ClubAPI request failed');
  }

  return response;
}

export function formatAmount(amount) {
  return parseFloat(amount).toFixed(2);
}

export function getTransactionType(type) {
  const key = String(type || '').toUpperCase();
  const types = {
    'MOBILE': 'mobile',
    'DTH': 'dth',
    'ELECTRICITY': 'electricity',
    'WATER': 'water',
    'GAS': 'gas'
  };
  return types[key] || 'other';
}
