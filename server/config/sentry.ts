/**
 * Sentry Configuration
 * Error reporting for production — no-op when SENTRY_DSN is absent
 */

import * as Sentry from '@sentry/node';
import { ENV } from './environment.js';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn('[sentry] SENTRY_DSN not set; error reporting disabled in this environment');
    return;
  }
  Sentry.init({
    dsn,
    environment: ENV.NODE_ENV,
    tracesSampleRate: ENV.NODE_ENV === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
  });
  console.log(`[sentry] initialised (env=${ENV.NODE_ENV})`);
}

export { Sentry };
