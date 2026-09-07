import mongoose from 'mongoose';
const qrSchema = new mongoose.Schema({
  userId:{type:mongoose.Schema.Types.ObjectId, ref:'User'},
  type: { type: String, enum: ['STATIC', 'P2P', 'P2C'], default: 'STATIC' },
  virtualAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'VirtualAccount' },
  payload: Object,
  imagePath: String,
  cloudinaryPublicId: String,
  expiresAt: { type: Date },
  isActive: { type: Boolean, default: true }
}, { timestamps:true });
export default mongoose.model('QRCode', qrSchema);
