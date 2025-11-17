import mongoose from 'mongoose';

const legalActionSchema = new mongoose.Schema({
  loanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actionType: {
    type: String,
    enum: ['warning_notice', 'legal_notice', 'court_notice'],
    required: true
  },
  noticeType: {
    type: String,
    enum: ['warning', 'formal', 'court'],
    default: 'warning'
  },
  message: {
    type: String,
    required: true
  },
  language: {
    type: String,
    enum: ['english', 'hindi'],
    default: 'english'
  },
  sendEmail: {
    type: Boolean,
    default: true
  },
  sendSMS: {
    type: Boolean,
    default: true
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  smsSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date
  },
  smsSentAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['initiated', 'sent', 'responded', 'escalated', 'resolved'],
    default: 'initiated'
  },
  response: {
    type: String
  },
  responseDate: {
    type: Date
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  },
  notes: {
    type: String
  },
  followUpDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
legalActionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
legalActionSchema.index({ loanId: 1, status: 1 });
legalActionSchema.index({ userId: 1 });
legalActionSchema.index({ actionType: 1 });
legalActionSchema.index({ createdAt: -1 });

export default mongoose.model('LegalAction', legalActionSchema);
