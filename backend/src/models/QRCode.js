import mongoose from 'mongoose';
const qrSchema = new mongoose.Schema({ userId:{type:mongoose.Schema.Types.ObjectId, ref:'User'}, payload:Object, imagePath:String }, { timestamps:true });
export default mongoose.model('QRCode', qrSchema);
