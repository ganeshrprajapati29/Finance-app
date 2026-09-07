import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, trim: true },
  description: { type: String, trim: true },
  imageUrl: { type: String, trim: true },
  thumbnailUrl: { type: String, trim: true },
  category: {
    type: String,
    enum: ['GENERAL', 'LOAN', 'QR', 'BILL', 'WALLET', 'SHOPPING', 'REFERRAL'],
    default: 'GENERAL',
    index: true
  },
  placement: {
    type: String,
    enum: ['HOME_BANNER', 'OFFERS_PAGE', 'POPUP', 'LOAN_APPLY', 'ALL'],
    default: 'ALL',
    index: true
  },
  ctaText: { type: String, default: 'View Offer' },
  ctaUrl: { type: String, trim: true },
  deepLink: { type: String, trim: true },
  couponCode: { type: String, trim: true },
  discountText: { type: String, trim: true },
  priority: { type: Number, default: 0, index: true },
  isActive: { type: Boolean, default: true, index: true },
  startAt: { type: Date, index: true },
  endAt: { type: Date, index: true },
  terms: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

offerSchema.index({ isActive: 1, placement: 1, priority: -1, createdAt: -1 });

export default mongoose.model('Offer', offerSchema);
