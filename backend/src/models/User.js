import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const kycDocSchema = new mongoose.Schema({ type:String, url:String, status:{type:String,enum:['PENDING','APPROVED','REJECTED'],default:'PENDING'}, notes:String }, { _id:false });
const userSchema = new mongoose.Schema({
  name:String, email:{type:String,unique:true,lowercase:true}, mobile:{type:String,unique:true},
  passwordHash:String, emailVerified:{type:Boolean,default:false},
  roles:{type:[String], default:['user']}, status:{type:String, enum:['active','blocked'], default:'active'},
  loanLimit:{ amount:{type:Number,default:0}, setBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}, setAt:Date },
  walletBalance:{type:Number,default:0},
  kyc:{ docs:[kycDocSchema], reviewedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}, reviewedAt:Date },
  fcmTokens:{ type:[String], default:[] }
}, { timestamps:true });

// Add comparePassword method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

export default mongoose.model('User', userSchema);
