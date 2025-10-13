import mongoose from 'mongoose';
const billSchema = new mongoose.Schema({
  userId:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  type:{ type:String, enum:['ELECTRICITY','WATER','MOBILE','DTH','RENT','OTHER'], default:'OTHER' },
  provider:String, accountRef:String, amount:Number, dueDate:Date,
  status:{ type:String, enum:['PENDING','PAID','CANCELLED'], default:'PENDING' }, paidAt:Date, notes:String
}, { timestamps:true });
export default mongoose.model('Bill', billSchema);
