import mongoose from 'mongoose';

const rewardCampaignSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, trim: true },
  description: { type: String, trim: true },
  imageUrl: { type: String, trim: true },
  type: {
    type: String,
    enum: ['OFFER', 'COUPON', 'CASHBACK', 'SCRATCH', 'PUZZLE', 'POINTS'],
    default: 'OFFER',
    index: true
  },
  placement: {
    type: String,
    enum: ['HOME', 'REWARDS', 'BILLS', 'RECHARGE', 'PAYMENT', 'ALL'],
    default: 'ALL',
    index: true
  },
  couponCode: { type: String, trim: true, uppercase: true },
  cashbackAmount: { type: Number, default: 0 },
  minCashback: { type: Number, default: 0 },
  maxCashback: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  minTxnAmount: { type: Number, default: 0 },
  puzzle: {
    question: String,
    options: [String],
    answerIndex: Number
  },
  terms: [{ type: String }],
  usageLimit: { type: Number, default: 0 },
  perUserLimit: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  priority: { type: Number, default: 0, index: true },
  isActive: { type: Boolean, default: true, index: true },
  startAt: { type: Date, index: true },
  endAt: { type: Date, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

rewardCampaignSchema.index({ isActive: 1, placement: 1, priority: -1, createdAt: -1 });

export default mongoose.model('RewardCampaign', rewardCampaignSchema);
