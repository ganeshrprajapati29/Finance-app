// backend/scripts/createAdmin.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js'; // path adjust karo agar alag ho

dotenv.config({ path: '../.env' }); // agar script backend root se run kar rahe ho

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/khatupay';
  await mongoose.connect(uri, {});

  const email = 'admin@example.com';
  const password = 'admin123!'; // change after first login
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log('Admin already exists:', existing._id.toString());
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 10);
  const admin = new User({
    name: 'KhatuPay Admin',
    email: email.toLowerCase(),
    mobile: '9999999998',
    passwordHash: hash,
    roles: ['admin'],
    emailVerified: true,
  });

  await admin.save();
  console.log('Admin created:', admin._id.toString(), ' email:', email, ' password:', password);
  process.exit(0);
}

run().catch((e)=>{ console.error(e); process.exit(1); });
