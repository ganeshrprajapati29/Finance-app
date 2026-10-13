import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  mobileCiphertext: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  usedAt: Date,
}, { timestamps: true });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.MobileOnboardingSession ||
  mongoose.model('MobileOnboardingSession', schema);
