import mongoose from 'mongoose';

const clubapiFundRequestSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 1 },
  paymentMode: {
    type: String,
    enum: ['UPI', 'IMPS', 'NEFT', 'RTGS', 'BANK_TRANSFER', 'CASH_DEPOSIT', 'OTHER'],
    default: 'IMPS',
  },
  utrNumber: { type: String, trim: true, uppercase: true },
  paymentDate: { type: Date, default: Date.now },
  bankAccountNumber: { type: String, trim: true },
  walletType: { type: String, enum: ['P2P', 'P2A'], default: 'P2P' },
  providerSubmitted: { type: Boolean, default: false },
  proofUrl: { type: String, trim: true },
  remarks: { type: String, trim: true, maxlength: 1000 },
  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'FAILED'],
    default: 'SUBMITTED',
    index: true,
  },
  providerReference: { type: String, trim: true },
  providerResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
  balanceBefore: { type: mongoose.Schema.Types.Mixed, default: {} },
  balanceAfter: { type: mongoose.Schema.Types.Mixed, default: {} },
  reviewedNote: { type: String, trim: true, maxlength: 1000 },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
}, { timestamps: true });

clubapiFundRequestSchema.index({ createdAt: -1 });
clubapiFundRequestSchema.index({ utrNumber: 1 }, { sparse: true });

export default mongoose.models.ClubAPIFundRequest ||
  mongoose.model('ClubAPIFundRequest', clubapiFundRequestSchema);
