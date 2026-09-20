import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantBusiness', required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  qrReference: { type: String, required: true, unique: true }, payload: { type: String, required: true },
  status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' },
}, { timestamps: true });
export default mongoose.models.MerchantQR || mongoose.model('MerchantQR', schema);
