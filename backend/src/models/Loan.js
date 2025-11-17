import mongoose from 'mongoose';

const refSchema = new mongoose.Schema({
  name: String,
  relation: String,
  mobile: String
}, { _id:false });

const docSchema = new mongoose.Schema({
  aadhaarFrontUrl: String,
  aadhaarBackUrl: String,
  panUrl: String,
  selfieUrl: String
}, { _id:false });

const bankSchema = new mongoose.Schema({
  bankName: String,
  accountNumber: String,
  ifscCode: String,
  accountHolderName: String
}, { _id:false });

const applicationSchema = new mongoose.Schema({
  // Old fields
  amountRequested: Number,
  tenureMonths: Number,
  purpose: String,
  // New structured fields
  personal: {
    name: String, email: String, mobile: String, address: String,
    fatherName: String, motherName: String,
  },
  qualification: {
    highestEducation: String, stream: String, institution: String,
  },
  employment: {
    employmentType: String, monthlyIncome: Number, employerOrBusiness: String, experienceYears: Number,
  },
  documents: docSchema,
  references: [refSchema],
  bankDetails: bankSchema,
}, { _id:false });

const partPaymentSchema = new mongoose.Schema({
  amount: Number,
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  paymentDate: Date,
  reference: String
}, { _id: false });

const extensionHistorySchema = new mongoose.Schema({
  originalDueDate: Date,
  newDueDate: Date,
  reason: String,
  notes: String,
  approvedBy: String,
  approvedAt: Date,
  approvedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const penaltySchema = new mongoose.Schema({
  installmentNo: Number,
  amount: Number,
  reason: String,
  dueDate: Date,
  status: { type: String, enum: ['PENDING', 'PAID', 'WAIVED'], default: 'PENDING' },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: Date
}, { _id: false });

const scheduleSchema = new mongoose.Schema({
  installmentNo: Number,
  dueDate: Date,
  principal: Number,
  interest: Number,
  total: Number,
  paid: { type: Boolean, default: false },
  paidAt: Date,
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  partPayments: [partPaymentSchema],
  extensionHistory: [extensionHistorySchema]
}, { _id:false });

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['WITHDRAWAL', 'REPAYMENT', 'PENALTY'], required: true },
  amount: { type: Number, required: true },
  bankName: String,
  accountNumber: String,
  ifscCode: String,
  accountHolderName: String,
  txnId: String,
  status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'COMPLETED' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const loanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref:'User', required: true },
  loanAccountNumber: { type: String, unique: true },
  application: applicationSchema,
  status: { type: String, enum: ['PENDING','APPROVED','REJECTED','DISBURSED','CLOSED'], default: 'PENDING' },
  decision: {
    amountApproved: Number, rateAPR: Number, tenureMonths: Number, decidedAt: Date, decidedBy: { type: mongoose.Schema.Types.ObjectId, ref:'User' }
  },
  disbursementDate: Date,
  transactions: [transactionSchema],
  schedule: [scheduleSchema],
  penalties: [penaltySchema],
  autoDebit: {
    enabled: { type: Boolean, default: false },
    updatedAt: Date,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, { timestamps: true });

export default mongoose.model('Loan', loanSchema);
