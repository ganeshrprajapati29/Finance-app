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
  selfieUrl: String,
  incomeProofUrl: String,
  incomeProofType: String,
  aadhaarEkyc: mongoose.Schema.Types.Mixed,
  panVerification: mongoose.Schema.Types.Mixed,
  // Per-document Cloudinary result: { [field]: { status, filename, message, attempts, updatedAt } }
  uploadStatus: mongoose.Schema.Types.Mixed,
  uploadReview: mongoose.Schema.Types.Mixed
}, { _id:false });

const bankSchema = new mongoose.Schema({
  bankName: String,
  accountNumber: String,
  ifscCode: String,
  accountHolderName: String,
  upiId: String,
  upiAccountName: String,
  bankValidation: mongoose.Schema.Types.Mixed,
  upiValidation: mongoose.Schema.Types.Mixed
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
  openingBalance: Number,
  closingBalance: Number,
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

const consentSchema = new mongoose.Schema({
  accepted: { type: Boolean, default: false },
  acceptedAt: Date,
  version: String,
  ipAddress: String,
  userAgent: String
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  title: String,
  message: String,
  reason: String,
  actorType: { type: String, enum: ['USER', 'ADMIN', 'SYSTEM'], default: 'SYSTEM' },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

// Borrower agreement + Aadhaar eSign lifecycle for this loan. decision.agreement*
// fields are kept in sync for older app/admin builds that still read them.
const agreementSchema = new mongoose.Schema({
  status: { type: String, enum: ['NOT_AVAILABLE', 'PENDING_SIGNATURE', 'SIGNING', 'SIGNED', 'FAILED'], default: 'NOT_AVAILABLE' },
  agreementUrl: String,
  agreementSha256: String,
  generatedAt: Date,
  documentId: String,
  documentReferenceId: String,
  referenceId: String,
  attempts: { type: Number, default: 0 },
  signingUrl: String,
  signingStartedAt: Date,
  signerStatus: String,
  providerStatus: String,
  lastError: String,
  lastSyncedAt: Date,
  signedAgreementUrl: String,
  signedAt: Date,
  auditTrailStatus: { type: String, default: 'NOT_STARTED' },
  auditTrail: mongoose.Schema.Types.Mixed,
  // Short claim so two taps on "Sign" cannot create two SignCare documents.
  lockUntil: Date,
}, { _id: false });

const loanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref:'User', required: true },
  loanAccountNumber: { type: String, unique: true },
  // Client-generated key per application draft; a resubmit returns the same loan.
  idempotencyKey: String,
  application: applicationSchema,
  status: { type: String, enum: ['PENDING','UNDER_REVIEW','DOCUMENTS_REQUIRED','APPROVED','REJECTED','DISBURSEMENT_PROCESSING','DISBURSED','OVERDUE','CLOSED'], default: 'PENDING' },
  decision: {
    amountApproved: Number, rateAPR: Number, tenureMonths: Number,
    processingFee: Number, taxAmount: Number, netDisbursalAmount: Number,
    totalRepaymentAmount: Number, totalInterest: Number, emi: Number, allInclusiveApr: Number,
    rejectionReason: String,
    lenderName: String, offerExpiresAt: Date, kfsUrl: String, agreementUrl: String,
    signedAgreementUrl: String, agreementStatus: String,
    agreementDocumentId: String, agreementSignedAt: Date,
    decidedAt: Date, decidedBy: { type: mongoose.Schema.Types.ObjectId, ref:'User' }
  },
  disbursementDate: Date,
  disbursement: {
    status: { type: String, enum: ['NOT_STARTED', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'NOT_STARTED' },
    amount: Number, netAmount: Number, reference: String, failureReason: String,
    initiatedAt: Date, completedAt: Date
  },
  consents: {
    creditReport: consentSchema,
    terms: consentSchema,
    privacy: consentSchema
  },
  verification: {
    provider: { type: String, default: 'SIGNCARE' },
    verificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanVerification' },
    snapshot: mongoose.Schema.Types.Mixed,
    capturedAt: Date,
  },
  agreement: { type: agreementSchema, default: undefined },
  statusHistory: [statusHistorySchema],
  transactions: [transactionSchema],
  schedule: [scheduleSchema],
  penalties: [penaltySchema],
  autoDebit: {
    enabled: { type: Boolean, default: false },
    updatedAt: Date,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, { timestamps: true });

loanSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
loanSchema.index({ 'agreement.status': 1, 'agreement.signingStartedAt': 1 });
loanSchema.index({ 'agreement.documentId': 1 });

export default mongoose.models.Loan || mongoose.model('Loan', loanSchema);
