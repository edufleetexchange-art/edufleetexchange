/**
 * CORS Configuration
 * Handles Cross-Origin Resource Sharing settings
 */

import { CorsOptions } from 'cors';
import { ENV, isProduction } from './environment.js';

export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = [
      ENV.CLIENT_URL,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
    ];

    // In production, only allow specified origins
    if (isProduction) {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, allow all origins
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
};

export default corsConfig;
