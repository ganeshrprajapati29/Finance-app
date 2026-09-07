import mongoose from 'mongoose';

const qrStickerOrderSchema = new mongoose.Schema({
  orderNo: { type: String, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  qrCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'QRCode' },
  qrImagePath: String,
  qrPayload: Object,
  stickerType: {
    type: String,
    enum: ['STANDARD', 'PREMIUM', 'SHOP_BOARD'],
    default: 'STANDARD'
  },
  quantity: { type: Number, required: true, min: 1 },
  freeQuantity: { type: Number, default: 0 },
  chargeableQuantity: { type: Number, default: 0 },
  unitPrice: { type: Number, default: 0 },
  deliveryCharge: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['FREE', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'],
    default: 'PENDING'
  },
  orderStatus: {
    type: String,
    enum: ['PLACED', 'PAYMENT_PENDING', 'CONFIRMED', 'PRINTING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    default: 'PAYMENT_PENDING'
  },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  shippingAddress: {
    name: String,
    mobile: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
    landmark: String
  },
  tracking: {
    courierName: String,
    trackingNumber: String,
    trackingUrl: String,
    shippedAt: Date,
    deliveredAt: Date
  },
  adminNote: String,
  userNote: String
}, { timestamps: true });

qrStickerOrderSchema.pre('validate', function setOrderNo(next) {
  if (!this.orderNo) this.orderNo = `KPSTK-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  next();
});

export default mongoose.model('QRStickerOrder', qrStickerOrderSchema);
