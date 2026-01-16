/**
 * Database Configuration
 * Handles MongoDB connection and configuration
 */

import mongoose from 'mongoose';
import { ENV, isProduction, isDevelopment } from './environment.js';

// MongoDB connection options
const mongooseOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
  family: 4, // Use IPv4, skip trying IPv6
};

export const connectDB = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log(`🔗 URI: ${ENV.MONGODB_URI}`);
    const conn = await mongoose.connect(ENV.MONGODB_URI, mongooseOptions);
    
    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
    console.log(`✓ Database Name: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✓ MongoDB reconnected');
    });
    
    // Enable debug mode in development
    if (isDevelopment) {
      mongoose.set('debug', true);
    }
    
    return conn;
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

// Graceful shutdown
export const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('✓ MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
  }
};

