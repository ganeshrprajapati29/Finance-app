import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  rate: { type: Number, required: true },
  total: { type: Number, required: true }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', unique: true, sparse: true },
  amount: { type: Number, required: true },
  taxableAmount: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  gstin: { type: String, default: '09AAMCK7213N1ZY' },
  companyName: { type: String, default: 'KHATUPAY SECURITIES PRIVATE LIMITED' },
  companyAddress: { type: String, default: 'S-216, Transport Nagar Road, Lucknow, Uttar Pradesh - 226012' },
  date: { type: Date, default: Date.now },
  dueDate: { type: Date },
  items: [itemSchema],
  status: { type: String, enum: ['PENDING', 'PAID', 'OVERDUE'], default: 'PENDING' },
  invoiceType: { type: String, default: 'PAYMENT' },
  description: String,
  notes: String
}, { timestamps: true });

export default mongoose.model('Invoice', invoiceSchema);
