import mongoose from 'mongoose'

const promiseToPaySchema = new mongoose.Schema({
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
  promisedAmount: {
    type: Number,
    required: true
  },
  promisedDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'KEPT', 'BROKEN', 'EXTENDED'],
    default: 'PENDING'
  },
  contactMethod: {
    type: String,
    enum: ['CALL', 'VISIT', 'SMS', 'EMAIL'],
    required: true
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
  reason: {
    type: String,
    required: true
  },
  followUpDate: {
    type: Date
  },
  actualPaymentDate: {
    type: Date
  },
  actualPaymentAmount: {
    type: Number
  },
  notes: {
    type: String
  },
  reminders: [{
    reminderDate: Date,
    reminderType: {
      type: String,
      enum: ['SMS', 'CALL', 'EMAIL']
    },
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

promiseToPaySchema.pre('save', function(next) {
  this.updatedAt = Date.now()
  next()
})

export default mongoose.model('PromiseToPay', promiseToPaySchema)
