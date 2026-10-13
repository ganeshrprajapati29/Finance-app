import mongoose from 'mongoose';
const otpSchema = new mongoose.Schema({ email:String, mobile:String, otp:String, purpose:{type:String,enum:['email_verify','password_reset','pin_reset','mobile_verify','mobile_login','mobile_auth']}, expiresAt:Date, used:{type:Boolean,default:false}, attempts:{type:Number,default:0} }, { timestamps:true });
otpSchema.index({ expiresAt:1 }, { expireAfterSeconds:0 });
otpSchema.index({ mobile: 1, purpose: 1, createdAt: -1 });
export default mongoose.model('Otp', otpSchema);
