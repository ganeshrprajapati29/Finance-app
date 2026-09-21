import mongoose from 'mongoose';

const stageSchema = new mongoose.Schema({
  status: { type: String, enum: ['NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED', 'REVIEW'], default: 'NOT_STARTED' },
  requestId: String,
  providerReference: String,
  message: String,
  verifiedAt: Date,
  updatedAt: Date,
  data: mongoose.Schema.Types.Mixed,
}, { _id: false });

const loanVerificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  provider: { type: String, default: 'SIGNCARE' },
  consent: {
    accepted: { type: Boolean, default: false }, text: String, version: String,
    acceptedAt: Date, ipAddress: String, userAgent: String,
  },
  pan: { type: stageSchema, default: () => ({}) },
  aadhaar: { type: stageSchema, default: () => ({}) },
  liveness: { type: stageSchema, default: () => ({}) },
  faceMatch: { type: stageSchema, default: () => ({}) },
  bank: { type: stageSchema, default: () => ({}) },
  credit: { type: stageSchema, default: () => ({}) },
  accountAggregator: { type: stageSchema, default: () => ({}) },
  agreement: { type: stageSchema, default: () => ({}) },
  eStamp: { type: stageSchema, default: () => ({}) },
  eSign: { type: stageSchema, default: () => ({}) },
  auditTrail: { type: stageSchema, default: () => ({}) },
}, { timestamps: true });

export default mongoose.models.LoanVerification || mongoose.model('LoanVerification', loanVerificationSchema);
