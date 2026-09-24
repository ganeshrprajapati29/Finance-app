import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantBusiness', required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  qrReference: { type: String, required: true, unique: true }, payload: { type: String, required: true },
  paymentUrl: String,
  payeeVpa: String,
  payeeName: String,
  qrImageDataUrl: String,
  provider: { type: String, default: 'VELXAPAY' },
  collectionMode: { type: String, default: 'VELXAPAY_CHECKOUT' },
  status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' },
  disabledAt: Date,
  disabledReason: String,
  statusHistory: [{
    status: String,
    note: String,
    actor: String,
    at: { type: Date, default: Date.now },
  }],
}, { timestamps: true });
export default mongoose.models.MerchantQR || mongoose.model('MerchantQR', schema);
