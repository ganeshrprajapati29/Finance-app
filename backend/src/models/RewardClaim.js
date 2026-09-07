import mongoose from 'mongoose';

const rewardClaimSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'RewardCampaign', required: true, index: true },
  type: String,
  couponCode: String,
  cashbackAmount: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  status: { type: String, enum: ['CLAIMED', 'REDEEMED', 'FAILED'], default: 'CLAIMED', index: true },
  note: String,
  walletBalanceAfter: Number,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

rewardClaimSchema.index({ userId: 1, campaignId: 1, createdAt: -1 });

export default mongoose.model('RewardClaim', rewardClaimSchema);
