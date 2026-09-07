import mongoose from 'mongoose';

const paymentChatMessageSchema = new mongoose.Schema({
  threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentChatThread', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['TEXT', 'PAYMENT'], default: 'TEXT' },
  text: String,
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  paymentStatus: { type: String, enum: ['PENDING', 'CONFIRMED', 'FAILED'], default: 'PENDING' },
  amount: Number,
  khatuPaymentId: String,
  meta: Object,
  readAt: Date
}, { timestamps: true });

export default mongoose.model('PaymentChatMessage', paymentChatMessageSchema);
