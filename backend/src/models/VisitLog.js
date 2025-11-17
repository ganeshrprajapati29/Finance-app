import mongoose from 'mongoose'

const visitLogSchema = new mongoose.Schema({
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
  visitType: {
    type: String,
    enum: ['FIELD_VISIT', 'OFFICE_VISIT', 'HOME_VISIT'],
    required: true
  },
  visitStatus: {
    type: String,
    enum: ['COMPLETED', 'PARTIAL', 'FAILED', 'RESCHEDULED'],
    required: true
  },
  contactPerson: {
    type: String,
    required: true
  },
  relationship: {
    type: String,
    enum: ['SELF', 'FAMILY', 'FRIEND', 'NEIGHBOR', 'COLLEAGUE', 'OTHER'],
    required: true
  },
  location: {
    address: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  visitPurpose: {
    type: String,
    enum: ['COLLECTION', 'VERIFICATION', 'LEGAL_NOTICE', 'SETTLEMENT', 'OTHER'],
    required: false
  },
  conversationSummary: {
    type: String,
    required: true
  },
  nextAction: {
    type: String,
    enum: ['FOLLOW_UP', 'VISIT_AGAIN', 'LEGAL', 'SETTLEMENT', 'PAYMENT_REMINDER', 'NONE'],
    required: true
  },
  nextActionDate: {
    type: Date
  },
  documentsCollected: [{
    type: String,
    enum: ['CHEQUE', 'POST_DATED_CHEQUE', 'PROMISSORY_NOTE', 'SETTLEMENT_AGREEMENT', 'LEGAL_DOCUMENTS', 'AADHAR_CARD', 'PAN_CARD', 'VOTER_ID', 'DRIVING_LICENSE', 'PASSPORT', 'BANK_STATEMENT', 'SALARY_SLIP', 'adhacrd', 'pancard', 'OTHER'],
    set: function(value) {
      return value === '' ? undefined : value;
    }
  }],
  paymentReceived: {
    amount: Number,
    method: {
      type: String,
      enum: ['CASH', 'CHEQUE', 'ONLINE_TRANSFER', 'OTHER']
    },
    reference: String
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
  photos: [{
    url: String,
    description: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

export default mongoose.model('VisitLog', visitLogSchema)
