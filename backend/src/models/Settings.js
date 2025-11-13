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
  smsEnabled: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
