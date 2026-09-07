import mongoose from 'mongoose';
const otpSchema = new mongoose.Schema({ email:String, otp:String, purpose:{type:String,enum:['email_verify','password_reset','pin_reset']}, expiresAt:Date, used:{type:Boolean,default:false}, attempts:{type:Number,default:0} }, { timestamps:true });
otpSchema.index({ expiresAt:1 }, { expireAfterSeconds:0 });
export default mongoose.model('Otp', otpSchema);
