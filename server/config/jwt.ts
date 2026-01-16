/**
 * JWT Configuration
 * Handles JSON Web Token settings for authentication
 */

import { ENV, isProduction } from './environment.js';

export const JWT_CONFIG = {
  secret: ENV.JWT_SECRET,
  expiresIn: ENV.JWT_EXPIRES_IN,
  refreshExpiresIn: ENV.JWT_REFRESH_EXPIRES_IN,
  
  // Cookie options for storing JWT
  cookieOptions: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  },
  
  // Token issuer and audience (optional, for additional security)
  issuer: 'edufleet-exchange',
  audience: 'edufleet-client',
};

export default JWT_CONFIG;
