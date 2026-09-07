import mongoose from 'mongoose';

const virtualCardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  applicationNo: { type: String, unique: true, index: true },
  cardId: { type: String, unique: true, sparse: true, index: true },
  cardholderName: { type: String, required: true, trim: true },
  mobile: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  purpose: { type: String, trim: true },
  monthlyLimit: { type: Number, default: 10000 },
  cardNumberMasked: String,
  cardNumber: String,
  cvv: String,
  expiryMonth: String,
  expiryYear: String,
  status: {
    type: String,
    enum: ['APPLIED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'FROZEN', 'BLOCKED', 'REJECTED', 'EXPIRED'],
    default: 'APPLIED',
    index: true
  },
  allowedServices: {
    type: [String],
    default: ['BILLS', 'RECHARGE', 'QR', 'LOAN_EMI', 'WALLET']
  },
  rejectionReason: String,
  adminNote: String,
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  blockedAt: Date,
  lastUsedAt: Date
}, { timestamps: true });

function randomDigits(length) {
  let value = '';
  for (let i = 0; i < length; i += 1) value += Math.floor(Math.random() * 10);
  return value;
}

function masked(number) {
  return `${number.slice(0, 4)} ${number.slice(4, 8)} ${number.slice(8, 12)} ${number.slice(12)}`.replace(/\d(?=\d{4})/g, 'X');
}

virtualCardSchema.pre('validate', function ensureIds(next) {
  if (!this.applicationNo) this.applicationNo = `KPVCAPP-${Date.now()}-${randomDigits(4)}`;
  if (['APPROVED', 'ACTIVE'].includes(this.status) && !this.cardNumber) {
    const cardNumber = `9058${randomDigits(12)}`;
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 5);
    this.cardId = `KPVC-${Date.now()}-${randomDigits(4)}`;
    this.cardNumber = cardNumber;
    this.cardNumberMasked = masked(cardNumber);
    this.cvv = randomDigits(3);
    this.expiryMonth = String(expiry.getMonth() + 1).padStart(2, '0');
    this.expiryYear = String(expiry.getFullYear()).slice(-2);
  }
  next();
});

export default mongoose.model('KhatuVirtualCard', virtualCardSchema);
