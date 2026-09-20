import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantBusiness', required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  panNumber: String, gstNumber: String, businessType: String,
  documents: { panUrl: String, businessProofUrl: String, addressProofUrl: String },
  status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
  submittedAt: Date, reviewedAt: Date, rejectionReason: String,
}, { timestamps: true });
export default mongoose.models.MerchantKyc || mongoose.model('MerchantKyc', schema);
