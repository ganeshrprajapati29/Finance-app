import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import Employee from '../src/models/Employee.js';

dotenv.config({ path: '../.env' });

const createEmployee = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/khatupay';
    await mongoose.connect(uri, {});

    const { name, email, phone, password, permissions } = {
      name: 'John Doe',
      email: 'employee@khatupay.com',
      phone: '1234567890',
      password: 'password123',
      permissions: {
        canManageUsers: false,
        canManageLoans: false,
        canManagePayments: false,
        canManageSupport: true,
        canSendNotifications: false,
        canViewAudit: false,
        canManageSettings: false,
      },
    };

    const exists = await Employee.findOne({ email: email.toLowerCase() });
    if (exists) {
      console.log('Employee already exists');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const employee = await Employee.create({
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      permissions,
      createdBy: null, // Created by script - make it optional for now
    });

    console.log('Employee created successfully:');
    console.log(`Name: ${employee.name}`);
    console.log(`Email: ${employee.email}`);
    console.log(`Password: ${password}`);
    console.log('Please change the password after first login.');

  } catch (error) {
    console.error('Error creating employee:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

createEmployee();
