import mongoose from 'mongoose';

const creditReportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: String, default: 'DECENTRO' },
  environment: { type: String, default: 'staging' },
  referenceId: { type: String, index: true },
  name: String,
  mobile: String,
  panMasked: String,
  bureau: String,
  status: String,
  score: Number,
  purpose: String,
  consent: {
    accepted: { type: Boolean, default: false },
    timestamp: Date,
    ip: String,
    userAgent: String
  },
  request: mongoose.Schema.Types.Mixed,
  response: mongoose.Schema.Types.Mixed
}, { timestamps: true });

export default mongoose.models.CreditReport || mongoose.model('CreditReport', creditReportSchema);
