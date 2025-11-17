import mongoose from 'mongoose'

const collectionSchema = new mongoose.Schema({
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
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  bucket: {
    type: String,
    enum: ['1-7', '8-15', '16-30', '31-60', '60-90'],
    required: true
  },
  daysOverdue: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'RESOLVED', 'LEGAL', 'SETTLED'],
    default: 'ACTIVE'
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM'
  },
  lastContactDate: {
    type: Date
  },
  nextFollowUpDate: {
    type: Date
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

collectionSchema.pre('save', function(next) {
  this.updatedAt = Date.now()
  next()
})

export default mongoose.model('Collection', collectionSchema)
