import mongoose from 'mongoose'

const smsLogSchema = new mongoose.Schema({
  collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
  loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  phone: String,
  message: { type: String, required: true },
  type: { type: String, enum: ['WARNING', 'LEGAL', 'REMINDER', 'PTP', 'OTHER'], default: 'WARNING' },
  status: { type: String, enum: ['SENT', 'FAILED'], default: 'SENT' },
  error: String,
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

export default mongoose.model('SmsLog', smsLogSchema)
