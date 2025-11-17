import mongoose from 'mongoose';

const settlementSchema = new mongoose.Schema({
  loanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  settlementAmount: {
    type: Number,
    required: true
  },
  originalOutstanding: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    enum: ['financial_hardship', 'negotiation', 'legal_risk', 'goodwill', 'other'],
    required: true
  },
  notes: {
    type: String
  },
  status: {
    type: String,
    enum: ['offered', 'accepted', 'rejected', 'expired'],
    default: 'offered'
  },
  offeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  acceptedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
settlementSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
settlementSchema.index({ loanId: 1, status: 1 });
settlementSchema.index({ userId: 1 });
settlementSchema.index({ expiresAt: 1 });

export default mongoose.model('Settlement', settlementSchema);
