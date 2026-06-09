import rateLimit from 'express-rate-limit';

/**
 * Per-IP limit on ad impression / click reports. Without this, anyone can
 * pump the counters indefinitely — distorting analytics and triggering
 * fraudulent over-billing of advertisers. 60 / minute is generous for a
 * single visitor (one ad slot rarely renders that often) and still bounds
 * a single-host abuse vector. Combine with a signed token from
 * getAdsByPlacement for a stronger guarantee.
 */
export const adAnalyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Bucket by IP + ad id so one fraudster can't hide behind a shared NAT.
  keyGenerator: (req: any) => `${req.ip}:${req.params?.id ?? 'none'}`,
  message: { success: false, error: 'Too many requests' },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * The public ad-request lead inbox is an outbound-PII amplifier. 5 / hour /
 * IP is plenty for real businesses and chokes scripted abuse.
 */
export const adRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests' },
  skip: () => process.env.NODE_ENV === 'test',
});
