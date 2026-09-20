import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  settlementId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantSettlement', required: true, unique: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantBusiness', required: true, index: true },
  providerOrderId: String, amount: Number,
  status: { type: String, enum: ['QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED'], default: 'QUEUED' },
  request: mongoose.Schema.Types.Mixed, response: mongoose.Schema.Types.Mixed, utr: String,
}, { timestamps: true });
export default mongoose.models.MerchantPayout || mongoose.model('MerchantPayout', schema);
