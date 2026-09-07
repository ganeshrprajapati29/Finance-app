import mongoose from 'mongoose';

const payoutSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  virtualAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'VirtualAccount' },
  razorpayPayoutId: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['pending', 'processing', 'processed', 'failed', 'cancelled'], default: 'pending' },
  mode: { type: String, enum: ['UPI', 'IMPS', 'NEFT', 'RTGS'], default: 'UPI' },
  accountDetails: {
    accountNumber: { type: String, required: true },
    ifsc: { type: String, required: true },
    name: { type: String, required: true },
    vpa: { type: String }
  },
  fees: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  reference: { type: String },
  notes: { type: String },
  razorpayData: { type: mongoose.Schema.Types.Mixed },
  processedAt: { type: Date },
  failureReason: { type: String }
}, { timestamps: true });

export default mongoose.model('Payout', payoutSchema);
