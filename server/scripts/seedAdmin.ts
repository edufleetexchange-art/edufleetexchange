import mongoose from 'mongoose';
import User from '../models/User.js';
import { connectDB } from '../config/database.js';

const seedAdmin = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@edufleet.com' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@edufleet.com',
      password: 'admin123',
      role: 'admin',
      isActive: true,
      isVerified: true,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin@edufleet.com',
      phone: '+1-800-ADMIN-00',
      subscription: {
        status: 'active',
        listingsUsed: 0,
        browseCount: 0,
      }
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