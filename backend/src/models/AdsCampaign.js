import mongoose from 'mongoose';

const adsCampaignSchema = new mongoose.Schema({
  partner: { type: String, required: true, trim: true },
  campaign: { type: String, required: true, trim: true },
  leadsClicks: { type: Number, default: 0 },
  perLeadRate: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'paused', 'completed', 'cancelled'], default: 'active' },
  startDate: Date,
  endDate: Date,
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

adsCampaignSchema.pre('save', function calculateTotal(next) {
  if (!this.totalEarned || this.isModified('leadsClicks') || this.isModified('perLeadRate')) {
    this.totalEarned = Number(this.leadsClicks || 0) * Number(this.perLeadRate || 0);
  }
  next();
});

export default mongoose.model('AdsCampaign', adsCampaignSchema);
