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
  type: {
    type: String,
    enum: ['loan', 'payment', 'kyc', 'support', 'general'],
    default: 'general',
  },
  priority: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM',
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
  fcmSent: {
    type: Number,
    default: 0,
  },
  fcmFailed: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['sent', 'partial', 'queued'],
    default: 'sent',
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
});

adminNotificationHistorySchema.index({ sentAt: -1 });
adminNotificationHistorySchema.index({ sentTo: 1, type: 1, priority: 1 });

export default mongoose.model('AdminNotificationHistory', adminNotificationHistorySchema);
