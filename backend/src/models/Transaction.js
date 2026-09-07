import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  urid: {
    type: String,
    required: true,
    maxlength: 20
  },
  operatorId: String,
  mobile: String,
  amount: Number,
  transactionType: {
    type: String,
    enum: ['mobile', 'dth', 'bbps'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'processing'],
    default: 'pending'
  },
  clubapiResponse: Object,
  customerMobile: String,
  bbpsId: String,
  opvalue1: String,
  opvalue2: String,
  opvalue3: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

transactionSchema.index({ urid: 1 });
transactionSchema.index({ createdAt: 1 });

export default mongoose.model('Transaction', transactionSchema);
