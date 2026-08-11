import mongoose from 'mongoose';

const clubAPITransactionSchema = new mongoose.Schema({
  urid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['bill_fetch', 'bill_payment', 'mobile', 'dth', 'other']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  provider: {
    type: String,
    required: true
  },
  accountRef: {
    type: String,
    required: true
  },
  billId: {
    type: String
  },
  customerMobile: {
    type: String
  },
  response: {
    type: mongoose.Schema.Types.Mixed
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  refund: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better query performance
clubAPITransactionSchema.index({ userId: 1, createdAt: -1 });
clubAPITransactionSchema.index({ status: 1 });
clubAPITransactionSchema.index({ type: 1 });

// Prevent OverwriteModelError during hot reloads (nodemon)
export default mongoose.models.ClubAPITransaction || mongoose.model('ClubAPITransaction', clubAPITransactionSchema);
