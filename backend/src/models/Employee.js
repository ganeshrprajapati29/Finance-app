import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true },
  passwordHash: { type: String, required: true },
  roles: { type: [String], default: ['employee'] },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  permissions: {
    canManageUsers: { type: Boolean, default: false },
    canManageLoans: { type: Boolean, default: false },
    canManagePayments: { type: Boolean, default: false },
    canManageSupport: { type: Boolean, default: true },
    canSendNotifications: { type: Boolean, default: false },
    canViewAudit: { type: Boolean, default: false },
    canManageSettings: { type: Boolean, default: false },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Add comparePassword method
employeeSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

export default mongoose.model('Employee', employeeSchema);
