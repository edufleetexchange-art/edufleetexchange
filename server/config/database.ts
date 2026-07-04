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
  // Atlas free-tier clusters can take >5s to resume from idle; 5s made
  // serverless cold starts fail spuriously.
  serverSelectionTimeoutMS: 10000,
  family: 4, // Use IPv4, skip trying IPv6
};

// Fail fast instead of buffering operations for 10s against a dead connection
// ("Connection operation buffering timed out"). The serverless handler checks
// readyState per request and reconnects, so buffering only hides failures.
mongoose.set('bufferCommands', false);

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
    // On a long-running server a missing DB is fatal — exit. In a serverless
    // function process.exit() aborts the in-flight response (the client sees
    // ERR_CONNECTION_CLOSED) and kills the warm instance; throw instead so
    // the handler can return an error and the next invocation retries.
    if (process.env.VERCEL) throw error;
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
