import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantBusiness', required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  accountHolderName: { type: String, required: true }, accountNumber: { type: String, required: true },
  ifscCode: { type: String, required: true }, bankName: String,
  status: { type: String, enum: ['PENDING', 'VERIFIED', 'FAILED'], default: 'PENDING' },
  verifiedAt: Date, verificationReference: String,
}, { timestamps: true });
export default mongoose.models.MerchantBankAccount || mongoose.model('MerchantBankAccount', schema);
