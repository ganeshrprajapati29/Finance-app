import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantBusiness', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantBankAccount', required: true },
  settlementId: { type: String, required: true, unique: true }, amount: { type: Number, required: true },
  status: { type: String, enum: ['REQUESTED', 'PROCESSING', 'SETTLED', 'FAILED'], default: 'REQUESTED', index: true },
  providerReference: String, utr: String, failureReason: String, requestedAt: Date, settledAt: Date,
}, { timestamps: true });
export default mongoose.models.MerchantSettlement || mongoose.model('MerchantSettlement', schema);
