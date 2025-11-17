import mongoose from 'mongoose';
const paymentSchema = new mongoose.Schema({
  userId:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  loanId:{ type:mongoose.Schema.Types.ObjectId, ref:'Loan' },
  billId:{ type:mongoose.Schema.Types.ObjectId, ref:'Bill' },
  installmentNo:{ type:Number },
  type:{ type:String, enum:['REPAYMENT','BILL','DISBURSEMENT','FEE','P2P','OTHER','PART_PAYMENT','PENALTY'], default:'OTHER' },
  amount:{ type:Number, required:true },
  method:{ type:String, enum:['UPI','BANK','CASH','RAZORPAY','OTHER','MANUAL'], default:'RAZORPAY' },
  reference:String,
  status:{ type:String, enum:['PENDING','CONFIRMED','FAILED'], default:'PENDING' },
  proofUrl:String,
  gateway:{ provider:String, orderId:String, paymentId:String, signature:String },
  payeeDetails:{ vpa:String, name:String, note:String }, // For P2P payments
  metadata: {
    installmentNo: Number,
    notes: String,
    paymentDate: Date,
    isPartPayment: { type: Boolean, default: false }
  }
}, { timestamps:true });
export default mongoose.model('Payment', paymentSchema);
