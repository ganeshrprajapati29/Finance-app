import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantBusiness', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantPayment' },
  settlementId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantSettlement' },
  idempotencyKey: { type: String, required: true, unique: true },
  type: { type: String, enum: ['COLLECTION_CREDIT', 'SETTLEMENT_DEBIT', 'REVERSAL'], required: true },
  amount: { type: Number, required: true }, availableOn: Date,
  status: { type: String, enum: ['PENDING', 'AVAILABLE', 'SETTLED', 'REVERSED'], default: 'PENDING' },
  description: String,
}, { timestamps: true });
export default mongoose.models.MerchantLedger || mongoose.model('MerchantLedger', schema);
