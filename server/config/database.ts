/**
 * Database Configuration
 * Handles MongoDB connection and configuration
 */

import mongoose from 'mongoose';
import { ENV, isDevelopment } from './environment.js';
import { logger } from './logger.js';

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
    logger.info('Connecting to MongoDB...');
    const conn = await mongoose.connect(ENV.MONGODB_URI, mongooseOptions);

    logger.info({ host: conn.connection.host, db: conn.connection.name }, 'MongoDB connected');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error({ err }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Enable debug mode in development
    if (isDevelopment) {
      mongoose.set('debug', true);
    }

    return conn;
  } catch (error) {
    logger.error({ err: error }, 'Error connecting to MongoDB');
    process.exit(1);
  }
};

// Graceful shutdown
export const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error({ err: error }, 'Error closing MongoDB connection');
  }
};
