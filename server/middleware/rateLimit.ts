import rateLimit from 'express-rate-limit';

/**
 * Per-IP credential-stuffing brake. 10 attempts / 15 min should be enough for
 * real humans even with shared NAT, but small enough to make automated stuffing
 * extremely slow.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Try again in a few minutes.' },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Forgot-password is an outbound-email amplifier. Three per hour per IP is
 * plenty for legitimate retries; anything more is an email-bomb attempt.
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many password-reset requests. Try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Signup is a free-account amplifier. Five per minute per IP keeps real users
 * happy while making mass-creation expensive.
 */
export const signupLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many signup requests. Slow down.' },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * General API guard. Applied at the app level to make sure no endpoint is a
 * spam amplifier even if it's missed in a per-route audit.
 */
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Slow down.' },
  skip: () => process.env.NODE_ENV === 'test',
});
