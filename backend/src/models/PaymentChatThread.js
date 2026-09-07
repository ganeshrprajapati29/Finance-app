import mongoose from 'mongoose';

const paymentChatThreadSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  participantKey: { type: String, unique: true, index: true },
  peerSnapshot: {
    name: String,
    mobile: String,
    upiId: String,
    bankName: String
  },
  lastMessage: String,
  lastPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  lastMessageAt: Date
}, { timestamps: true });

export default mongoose.model('PaymentChatThread', paymentChatThreadSchema);
