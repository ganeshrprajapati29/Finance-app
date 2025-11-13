import mongoose from 'mongoose';

const adminNotificationHistorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  sentTo: {
    type: String,
    enum: ['all', 'user'],
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // null if sent to all
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // admin who sent
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
  totalRecipients: {
    type: Number,
    required: true,
  },
});

export default mongoose.model('AdminNotificationHistory', adminNotificationHistorySchema);
