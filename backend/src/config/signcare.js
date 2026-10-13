import 'dotenv/config';

const webhookSecret = String(process.env.SIGNCARE_WEBHOOK_SECRET || '').trim();

// SignCare only calls the URL we hand it, so the shared secret travels as a
// query token that signcareWebhook.js checks before trusting the body.
function withWebhookToken(url) {
  if (!webhookSecret || !url) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(webhookSecret)}`;
}

const signcareConfig = {
  baseURL: process.env.SIGNCARE_BASE_URL || 'https://ext.signcare.io',
  apiKey: process.env.SIGNCARE_API_KEY || '',
  appId: process.env.SIGNCARE_APP_ID || '',
  webhookSecret,
  webhookUrl: withWebhookToken(process.env.SIGNCARE_WEBHOOK_URL || 'https://khatupay.com/api/signcare/webhook'),
  returnUrl: process.env.SIGNCARE_RETURN_URL || 'https://khatupay.com/loan-signing-complete',
  // The app's WebView closes itself when DigiLocker redirects here.
  digilockerRedirectUrl: process.env.SIGNCARE_DIGILOCKER_REDIRECT_URL || 'https://khatupay.com/loan-signing-complete?flow=digilocker&status=completed',
  wealthSyncEnabled: String(process.env.SIGNCARE_WEALTHSYNC_ENABLED || '').toLowerCase() === 'true',
};

export default signcareConfig;
