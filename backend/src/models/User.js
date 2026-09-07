import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const kycDocSchema = new mongoose.Schema({
  type: String,
  documentType: String,
  documentNumber: String,
  url: String,
  public_id: String,
  publicId: String,
  originalName: String,
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  notes: String,
  submittedAt: { type: Date, default: Date.now }
}, { _id:false });
const userSchema = new mongoose.Schema({
  name:String, email:{type:String,unique:true,lowercase:true}, mobile:{type:String,unique:true},
  passwordHash:String, mpinHash:String, emailVerified:{type:Boolean,default:false},
  pinAttempts:{type:Number, default:0}, pinLockedUntil:Date, pinResetRequired:{type:Boolean, default:false},
  // Bumped on password/PIN reset or explicit "log out everywhere"; refresh
  // tokens carry the version they were issued under and are rejected once
  // it no longer matches, giving real server-side session revocation.
  sessionVersion:{type:Number, default:0},
  notificationsEnabled:{type:Boolean, default:true},
  security:{
    lastLoginAt: Date,
    lastLoginIp: String,
    lastLoginUserAgent: String,
    lastSuspiciousLoginAt: Date,
  },
  roles:{type:[String], default:['user']}, status:{type:String, enum:['active','blocked'], default:'active'},
  upiId:{type:String,trim:true,lowercase:true},
  khatuUpiId:{type:String,trim:true,lowercase:true,unique:true,sparse:true},
  bankName:{type:String,trim:true},
  accountName:{type:String,trim:true},
  loanLimit:{ amount:{type:Number,default:0}, setBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}, setAt:Date },
  walletBalance:{type:Number,default:0},
  kyc:{
    status: { type: String, enum: ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    kycNumber: { type: String, trim: true, uppercase: true },
    documentType: String,
    documentNumber: String,
    aadhaarNumber: String,
    aadhaarMobile: String,
    aadhaarVerified: { type: Boolean, default: false },
    aadhaarOtp: mongoose.Schema.Types.Mixed,
    aadhaarVerification: mongoose.Schema.Types.Mixed,
    aadhaarData: mongoose.Schema.Types.Mixed,
    panNumber: String,
    panVerified: { type: Boolean, default: false },
    panName: String,
    panData: mongoose.Schema.Types.Mixed,
    panVerification: mongoose.Schema.Types.Mixed,
    docs:[kycDocSchema],
    documents:[kycDocSchema],
    submittedAt: Date,
    reviewedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
    reviewedAt:Date,
    approvedAt:Date,
    rejectionReason:String
  },
  fcmTokens:{ type:[String], default:[] }
}, { timestamps:true });

// Add comparePassword method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

export default mongoose.model('User', userSchema);
