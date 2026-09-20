import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  appName: { type: String, default: 'Khatu Pay' },
  appVersion: { type: String, default: '1.0.0' },
  supportEmail: { type: String, default: 'support@khatupay.com' },
  maintenanceMode: { type: Boolean, default: false },
  maxLoanAmount: { type: Number, default: 50000 },
  minLoanAmount: { type: Number, default: 1000 },
  interestRate: { type: Number, default: 12.5 },
  loanDuration: { type: Number, default: 12 },
  fcmEnabled: { type: Boolean, default: false },
  emailEnabled: { type: Boolean, default: true },
  smsEnabled: { type: Boolean, default: false },
  appUpdate: {
    android: {
      latestVersion: { type: String, default: '1.0.1' },
      latestBuild: { type: Number, default: 32, min: 1 },
      minimumSupportedBuild: { type: Number, default: 32, min: 1 },
      forceUpdate: { type: Boolean, default: false },
      message: {
        type: String,
        default: 'A new Khatu Pay update is available. Update now for the latest improvements and security fixes.'
      },
      storeUrl: {
        type: String,
        default: 'https://play.google.com/store/apps/details?id=com.finance.khatupay'
      }
    }
  },
  clubapi: {
    enabled: { type: Boolean, default: true },
    baseUrl: { type: String, default: 'https://api.clubapi.in' },
    callbackUrl: { type: String, default: 'https://khatupay.com/api/callback/clubapi' },
    callbackId: { type: String, default: '' },
    timeout: { type: Number, default: 30000 },
    retryAttempts: { type: Number, default: 3 },
    billFetchEnabled: { type: Boolean, default: true },
    billPaymentEnabled: { type: Boolean, default: true },
    mobileRechargeEnabled: { type: Boolean, default: true },
    dthRechargeEnabled: { type: Boolean, default: true }
  }
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
