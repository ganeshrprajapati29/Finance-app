import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  publicId: { type: String, required: true, unique: true, index: true },
  businessName: { type: String, required: true, trim: true },
  ownerName: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  mobile: { type: String, required: true }, email: String, address: String,
  status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'], default: 'DRAFT', index: true },
  rejectionReason: String,
}, { timestamps: true });

export default mongoose.models.MerchantBusiness || mongoose.model('MerchantBusiness', schema);
