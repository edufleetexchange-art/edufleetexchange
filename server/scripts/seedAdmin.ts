import mongoose from 'mongoose';
import Account from '../models/Account.js';
import { connectDB } from '../config/database.js';

const seedAdmin = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Account.findOne({ email: 'admin@edufleet.com' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create admin account
    const admin = await Account.create({
      name: 'Admin User',
      email: 'admin@edufleet.com',
      password: 'admin123',
      role: 'admin',
      isActive: true,
      isVerified: true,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin@edufleet.com',
      phone: '+1-800-ADMIN-00',
    });

    console.log('Admin user created successfully:');
    console.log('Email: admin@edufleet.com');
    console.log('Password: admin123');
    console.log('Role: admin');
    console.log('\nAdmin ID:', admin._id);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();