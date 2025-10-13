import mongoose from 'mongoose';
const ticketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref:'User', required: true },
  subject: String,
  message: String,
  status: { type: String, enum:['OPEN','IN_PROGRESS','RESOLVED','CLOSED'], default:'OPEN' },
  adminNotes: String
},{ timestamps:true });
export default mongoose.model('SupportTicket', ticketSchema);
