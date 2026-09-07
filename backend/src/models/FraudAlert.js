import mongoose from 'mongoose';

const fraudAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['HIGH_VELOCITY', 'UNUSUAL_AMOUNT', 'GEOGRAPHIC_ANOMALY', 'DEVICE_FINGERPRINT', 'SUSPICIOUS_PATTERN'],
    required: true
  },
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM'
  },
  description: {
    type: String,
    required: true
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'transactionModel'
  },
  transactionModel: {
    type: String,
    enum: ['Payment', 'Transaction']
  },
  metadata: {
    amount: Number,
    transactionCount: Number,
    timeWindow: Number, // in minutes
    location: String,
    deviceFingerprint: String,
    riskScore: Number,
    rulesTriggered: [String]
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'REVIEWED', 'RESOLVED', 'FALSE_POSITIVE'],
    default: 'ACTIVE'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  notes: String
}, { timestamps: true });

// Indexes for efficient querying
fraudAlertSchema.index({ userId: 1, status: 1 });
fraudAlertSchema.index({ type: 1, createdAt: -1 });
fraudAlertSchema.index({ severity: 1, status: 1 });

export default mongoose.model('FraudAlert', fraudAlertSchema);
