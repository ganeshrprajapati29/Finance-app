import mongoose from 'mongoose'

const callLogSchema = new mongoose.Schema({
  collectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collection',
    required: false,
    set: function(value) {
      return value === '' ? undefined : value;
    }
  },
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
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  callType: {
    type: String,
    enum: ['INBOUND', 'OUTBOUND'],
    required: true
  },
  callStatus: {
    type: String,
    enum: ['CONNECTED', 'NO_ANSWER', 'BUSY', 'WRONG_NUMBER', 'DISCONNECTED'],
    required: true
  },
  callDuration: {
    type: Number, // in seconds
    default: 0
  },
  contactPerson: {
    type: String,
    required: true
  },
  relationship: {
    type: String,
    enum: ['SELF', 'FAMILY', 'FRIEND', 'COLLEAGUE', 'OTHER'],
    required: true
  },
  conversationSummary: {
    type: String,
    required: true
  },
  nextAction: {
    type: String,
    enum: ['FOLLOW_UP', 'VISIT', 'LEGAL', 'SETTLEMENT', 'PAYMENT_REMINDER', 'NONE'],
    required: true
  },
  nextActionDate: {
    type: Date
  },
  promiseToPay: {
    amount: Number,
    date: Date,
    status: {
      type: String,
      enum: ['PENDING', 'KEPT', 'BROKEN'],
      default: 'PENDING'
    }
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

export default mongoose.model('CallLog', callLogSchema)
