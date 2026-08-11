import mongoose from 'mongoose';
const paymentSchema = new mongoose.Schema({
  khatuPaymentId:{ type:String, unique:true, index:true },
  userId:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  payeeUserId:{ type:mongoose.Schema.Types.ObjectId, ref:'User' },
  loanId:{ type:mongoose.Schema.Types.ObjectId, ref:'Loan' },
  billId:{ type:mongoose.Schema.Types.ObjectId, ref:'Bill' },
  installmentNo:{ type:Number },
  type:{ type:String, enum:['REPAYMENT','FULL_REPAYMENT','BILL','DISBURSEMENT','FEE','P2P','WALLET_TOPUP','WALLET_SPEND','RECHARGE','OTHER','PART_PAYMENT','PENALTY'], default:'OTHER' },
  amount:{ type:Number, required:true },
  method:{ type:String, enum:['UPI','BANK','CASH','RAZORPAY','WALLET','OTHER','MANUAL'], default:'RAZORPAY' },
  reference:String,
  status:{ type:String, enum:['PENDING','CONFIRMED','FAILED','REFUNDED'], default:'PENDING' },
  proofUrl:String,
  gateway:{ provider:String, orderId:String, paymentId:String, signature:String },
  payeeDetails:{ vpa:String, name:String, mobile:String, note:String, bankName:String, accountName:String }, // For P2P payments
  metadata: {
    installmentNo: Number,
    notes: String,
    paymentDate: Date,
    isPartPayment: { type: Boolean, default: false },
    stickerOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'QRStickerOrder' },
    clubapiTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClubAPITransaction' },
    rechargeProcessedAt: Date,
    recharge: mongoose.Schema.Types.Mixed,
    refund: mongoose.Schema.Types.Mixed
  }
}, { timestamps:true });

paymentSchema.pre('validate', function setKhatuPaymentId(next) {
  if (!this.khatuPaymentId) this.khatuPaymentId = `KPTXN${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
  next();
});

export default mongoose.model('Payment', paymentSchema);
