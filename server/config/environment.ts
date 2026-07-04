/**
 * Environment Configuration
 * Centralizes all environment variable access with type safety and defaults
 */

import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function requiredSecret(name: string, minBytes: number, forbidden: string[] = []): string {
  // Tests need to boot without a real production secret; allow an explicit override
  // there but still demand SOMETHING (so signing always uses a known good value).
  const v = process.env[name] ?? (process.env.NODE_ENV === 'test' ? 'test-only-secret-do-not-use-anywhere-else' : undefined);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  if (Buffer.byteLength(v, 'utf8') < minBytes) {
    throw new Error(`${name} must be at least ${minBytes} bytes`);
  }
  if (forbidden.includes(v)) {
    throw new Error(`${name} is set to the placeholder value — generate a real secret (openssl rand -hex 32)`);
  }
  return v;
}

export const ENV = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),

  // Database — tests connect via mongodb-memory-server (tests/setup.ts) and
  // never read this value, but the module must be importable without a real
  // URI in CI, where no .env exists. Same escape hatch as JWT_SECRET below.
  MONGODB_URI:
    process.env.MONGODB_URI ??
    (process.env.NODE_ENV === 'test'
      ? 'mongodb://127.0.0.1:27017/test-placeholder-never-used'
      : required('MONGODB_URI')),
  // JWT — fail fast in every environment if the secret is missing, too short, or the well-known placeholder.
  JWT_SECRET: requiredSecret('JWT_SECRET', 32, ['your-secret-key-change-in-production', 'change-me', 'secret']),
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
