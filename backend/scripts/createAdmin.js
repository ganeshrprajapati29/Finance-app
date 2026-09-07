import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: 'src/.env' });

async function run() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('MONGO_URI not found in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const email = process.env.ADMIN_EMAIL || 'khatupay@gmail.com';
  const password = process.env.ADMIN_PASSWORD;
  const mobile = process.env.ADMIN_MOBILE || '7080655021';

  if (!password) {
    console.error('ADMIN_PASSWORD not found in environment');
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { mobile }],
  });

  if (existing) {
    existing.name = 'Khatu Pay Admin';
    existing.email = email.toLowerCase();
    existing.mobile = mobile;
    existing.passwordHash = passwordHash;
    existing.roles = Array.from(new Set([...(existing.roles || []), 'admin']));
    existing.status = 'active';
    existing.emailVerified = true;
    await existing.save();

    console.log('Admin updated successfully');
    console.log('ID:', existing._id.toString());
    console.log('Email:', email);
    process.exit(0);
  }

  const admin = new User({
    name: 'Khatu Pay Admin',
    email: email.toLowerCase(),
    mobile,
    passwordHash,
    roles: ['admin'],
    status: 'active',
    emailVerified: true,
  });

  await admin.save();

  console.log('Admin created successfully');
  console.log('ID:', admin._id.toString());
  console.log('Email:', email);
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
