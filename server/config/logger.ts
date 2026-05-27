/**
 * Pino Structured Logger
 * JSON in production, pretty-printed in development
 */

import { pino } from 'pino';
import { ENV } from './environment.js';

const isDev = ENV.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
    : undefined,
  base: { service: 'edufleet-server', env: ENV.NODE_ENV },
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
});
