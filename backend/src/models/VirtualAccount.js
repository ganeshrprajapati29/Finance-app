import mongoose from 'mongoose';

const virtualAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  razorpayVirtualAccountId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  customerId: { type: String },
  status: { type: String, enum: ['active', 'inactive', 'closed'], default: 'active' },
  isActive: { type: Boolean, default: true },
  balance: { type: Number, default: 0 },
  totalCredits: { type: Number, default: 0 },
  totalDebits: { type: Number, default: 0 },
  receivers: {
    vpa: [{
      id: String,
      address: String,
      status: String
    }]
  },
  razorpayData: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

// Index for efficient queries
virtualAccountSchema.index({ userId: 1, isActive: 1 });

export default mongoose.model('VirtualAccount', virtualAccountSchema);
