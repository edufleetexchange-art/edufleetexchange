/**
 * Central Configuration Export
 * Single entry point for all server configurations
 */

import { ENV, isProduction, isDevelopment, isTest } from './environment.js';
import { connectDB, disconnectDB } from './database.js';
import { JWT_CONFIG } from './jwt.js';
import { corsConfig } from './cors.js';
import { configureApp } from './app.js';
import {
  storage,
  imageFileFilter,
  documentFileFilter,
  uploadLimits,
  multerConfig,
} from './multer.js';

// Environment variables and constants
export { ENV, isProduction, isDevelopment, isTest };

// Database configuration
export { connectDB, disconnectDB };

// JWT configuration
export { JWT_CONFIG };

// CORS configuration
export { corsConfig };

// App configuration
export { configureApp };

// Multer configuration
export {
  storage,
  imageFileFilter,
  documentFileFilter,
  uploadLimits,
  multerConfig,
};

// Re-export for convenience
export default {
  ENV,
  isProduction,
  isDevelopment,
  isTest,
  JWT_CONFIG,
  corsConfig,
  multerConfig,
  connectDB,
  disconnectDB,
  configureApp,
};