import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantBusiness', required: true, index: true },
  merchantUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  orderId: { type: String, required: true, unique: true, index: true },
  amount: { type: Number, required: true }, netAmount: Number, currency: { type: String, default: 'INR' },
  customer: { firstName: String, lastName: String, email: String, phone: String },
  status: { type: String, enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'], default: 'CREATED', index: true },
  checkoutUrl: String, utr: String, providerTransactionId: String,
  provider: mongoose.Schema.Types.Mixed, creditedAt: Date, failedAt: Date,
}, { timestamps: true });
export default mongoose.models.MerchantPayment || mongoose.model('MerchantPayment', schema);
