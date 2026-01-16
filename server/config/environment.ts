/**
 * Environment Configuration
 * Centralizes all environment variable access with type safety and defaults
 */

export const ENV = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  
  // Database
  MONGODB_URI:'mongodb+srv://edufleet-exchange:IZTSSecuHdkY7rww@cluster0.lpjvk8x.mongodb.net/EDUFLEET-EXCHANGE?retryWrites=true&w=majority&appName=EDUFLEET-EXCHANGE',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  
  // Client
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  
  // File Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB default
  MAX_FILES: parseInt(process.env.MAX_FILES || '10', 10),
  
  // API
  API_PREFIX: process.env.API_PREFIX || '/api',
  
  // Google OAuth (if needed)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
} as const;

export const isProduction = ENV.NODE_ENV === 'production';
export const isDevelopment = ENV.NODE_ENV === 'development';
export const isTest = ENV.NODE_ENV === 'test';
