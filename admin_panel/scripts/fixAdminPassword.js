import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../src/models/User.js';

dotenv.config({ path: '../.env' });

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/khatupay');
  const admin = await User.findOne({ email: 'admin@gmail.com' });
  if (!admin) {
    console.log('Admin not found. Please register first.');
    process.exit(0);
  }

  // If passwordHash missing, fix it
  if (!admin.passwordHash && admin.password) {
    admin.passwordHash = await bcrypt.hash(admin.password, 12);
    admin.password = undefined;
  } else if (!admin.passwordHash) {
    admin.passwordHash = await bcrypt.hash('admin123!', 12);
  }

  await admin.save();
  console.log('✅ Admin password fixed. Use email: admin@khatupay.local / Admin@12345!');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
