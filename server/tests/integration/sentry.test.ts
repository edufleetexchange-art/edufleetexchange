import { describe, it, expect } from 'vitest';
import { initSentry } from '../../config/sentry.js';

describe('sentry init', () => {
  it('does not throw when SENTRY_DSN is unset', () => {
    const prev = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    expect(() => initSentry()).not.toThrow();
    if (prev) process.env.SENTRY_DSN = prev;
  });
});
