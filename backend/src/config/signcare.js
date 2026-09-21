const signcareConfig = {
  baseURL: process.env.SIGNCARE_BASE_URL || 'https://ext.signcare.io',
  apiKey: process.env.SIGNCARE_API_KEY || '',
  appId: process.env.SIGNCARE_APP_ID || '',
  webhookUrl: process.env.SIGNCARE_WEBHOOK_URL || 'https://khatupay.com/api/signcare/webhook',
  returnUrl: process.env.SIGNCARE_RETURN_URL || 'https://khatupay.com/loan-signing-complete',
  wealthSyncEnabled: String(process.env.SIGNCARE_WEALTHSYNC_ENABLED || '').toLowerCase() === 'true',
};

export default signcareConfig;
