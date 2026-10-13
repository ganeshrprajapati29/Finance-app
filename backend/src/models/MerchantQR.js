import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'MerchantBusiness', required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  qrReference: { type: String, required: true, unique: true }, payload: { type: String, required: true },
  providerQrId: { type: String, index: true },
  paymentUrl: String,
  payeeVpa: String,
  payeeName: String,
  qrImageDataUrl: String,
  provider: { type: String, default: 'RAZORPAY_PARTNER' },
  collectionMode: { type: String, default: 'RAZORPAY_PARTNER_QR' },
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
