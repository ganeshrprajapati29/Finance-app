import mongoose from 'mongoose';
const kycDocSchema = new mongoose.Schema({ type:String, url:String, status:{type:String,enum:['PENDING','APPROVED','REJECTED'],default:'PENDING'}, notes:String }, { _id:false });
const userSchema = new mongoose.Schema({
  name:String, email:{type:String,unique:true,lowercase:true}, mobile:{type:String,unique:true},
  passwordHash:String, emailVerified:{type:Boolean,default:false},
  roles:{type:[String], default:['user']}, status:{type:String, enum:['active','blocked'], default:'active'},
  loanLimit:{ amount:{type:Number,default:0}, setBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}, setAt:Date },
  kyc:{ docs:[kycDocSchema], reviewedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}, reviewedAt:Date },
  fcmTokens:{ type:[String], default:[] }
}, { timestamps:true });
export default mongoose.model('User', userSchema);
