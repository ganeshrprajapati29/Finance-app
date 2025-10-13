import mongoose from 'mongoose';
const auditSchema = new mongoose.Schema({ actorId:{type:mongoose.Schema.Types.ObjectId, ref:'User'}, action:String, entityType:String, entityId:String, meta:Object }, { timestamps:true });
export default mongoose.model('AuditLog', auditSchema);
