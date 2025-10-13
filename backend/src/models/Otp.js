import mongoose from 'mongoose';
const otpSchema = new mongoose.Schema({ email:String, otp:String, purpose:{type:String,enum:['email_verify','password_reset']}, expiresAt:Date, used:{type:Boolean,default:false} }, { timestamps:true });
otpSchema.index({ expiresAt:1 }, { expireAfterSeconds:0 });
export default mongoose.model('Otp', otpSchema);
