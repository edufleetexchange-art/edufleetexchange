/**
 * EduFleet Exchange Server
 * Main entry point for the backend API server
 */

import express, { Application, Request, Response } from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';

// Load environment variables first
dotenv.config();

// Sentry must be initialised before any other imports that might throw
import { initSentry, Sentry } from './config/sentry.js';
initSentry();

// Import configurations
import { ENV, connectDB, disconnectDB, configureApp } from './config/index.js';
import { pinoHttp } from 'pino-http';
import { logger } from './config/logger.js';

// Import routes
import authRoutes from './routes/auth.js';
import vehicleRoutes from './routes/vehicles.js';
import adminRoutes from './routes/admin.js';
import jobRoutes from './routes/jobs.js';
import supplierRoutes from './routes/suppliers.js';
import notificationRoutes from './routes/notifications.js';
import uploadRoutes from './routes/upload.js';
import subscriptionRoutes from './routes/subscriptions.js';

import adRoutes from './routes/ads.js';
import marketingRoutes from './routes/marketing.js';
import salesRoutes from './routes/sales.js';
import personaAccessRoutes from './routes/personaAccessRoutes.js';
import crmRoutes from './routes/crm.js';
import publicRoutes from './routes/public.js';
import accountRoutes from './routes/accounts.js';
import teacherRoutes from './routes/teachers.js';
import instituteRoutes from './routes/institutes.js';
import vendorRoutes from './routes/vendors.js';
import reportRoutes from './routes/reports.js';
import recommendationRoutes from './routes/recommendations.js';
import reviewRoutes from './routes/reviews.js';
import verificationRoutes from './routes/verifications.js';
import rosterRoutes from './routes/roster.js';
import placementRoutes from './routes/placements.js';
import interviewRoutes from './routes/interviews.js';
import consultantRoutes from './routes/consultants.js';
import alertRoutes from './routes/alerts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app: Application = express();

// Disable Express's extended (qs) query parser. With it on, `?role[$ne]=admin`
// becomes `req.query.role = { $ne: 'admin' }` — flowing operator objects
// straight into Mongoose finders. With the simple parser, the same input is
// the literal string `[$ne]=admin`, which fails any enum/regex validation.
// Combine with per-field validation in controllers for defence in depth.
app.set('query parser', 'simple');

// HTTP request logger (before routes)
app.use(pinoHttp({
  logger,
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req: IncomingMessage & { url?: string; method?: string; id?: unknown }) => ({
      method: req.method,
      url: req.url,
      id: req.id,
    }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
}));

// Apply app configuration (middleware, security headers, etc.)
configureApp(app);

// Lazy, cached DB connection. Works for both the local long-running server AND
// Vercel serverless, where each cold start must reuse a single pooled connection
// (eagerly connecting at import would exhaust Atlas connections under load).
let dbReady: Promise<unknown> | null = null;
function ensureDB(): Promise<unknown> {
  // A previously-resolved promise can hide a since-dropped connection —
  // Atlas closes idle connections and warm lambdas outlive them.
  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting.
  const state = mongoose.connection.readyState as number;
  if (dbReady && state !== 1 && state !== 2) {
    dbReady = null;
  }
  if (!dbReady) {
    dbReady = connectDB().catch((err) => {
      // Never cache a rejected promise — it would poison every subsequent
      // request on this warm instance.
      dbReady = null;
      throw err;
    });
  }
  return dbReady;
}

// Uploads dir + static serving only make sense on a persistent host — Vercel's
// serverless filesystem is read-only/ephemeral, so skip it there.
const uploadsDir = path.join(__dirname, '../uploads');
if (!process.env.VERCEL) {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    logger.info('Created uploads directory');
  }
  app.use('/uploads', express.static(uploadsDir));
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    environment: ENV.NODE_ENV,
    timestamp: new Date().toISOString(),
    database: 'connected',
  });
});

// API Routes (using API_PREFIX from config)
const apiPrefix = ENV.API_PREFIX;
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/public`, publicRoutes);
app.use(`${apiPrefix}/vehicles`, vehicleRoutes);
app.use(`${apiPrefix}/admin`, adminRoutes);
app.use(`${apiPrefix}/jobs`, jobRoutes);
app.use(`${apiPrefix}/suppliers`, supplierRoutes);
app.use(`${apiPrefix}/notifications`, notificationRoutes);
app.use(`${apiPrefix}/upload`, uploadRoutes);
app.use(`${apiPrefix}/subscriptions`, subscriptionRoutes);
app.use(`${apiPrefix}/marketing`, marketingRoutes);
app.use(`${apiPrefix}/sales`, salesRoutes);

app.use(`${apiPrefix}/ads`, adRoutes);
app.use(`${apiPrefix}/access`, personaAccessRoutes);
app.use(`${apiPrefix}/crm`, crmRoutes);
app.use(`${apiPrefix}/accounts`, accountRoutes);
app.use(`${apiPrefix}/teachers`, teacherRoutes);
app.use(`${apiPrefix}/institutes`, instituteRoutes);
app.use(`${apiPrefix}/vendors`, vendorRoutes);
app.use(`${apiPrefix}/reports`, reportRoutes);
app.use(`${apiPrefix}/recommendations`, recommendationRoutes);
app.use(`${apiPrefix}/reviews`, reviewRoutes);
app.use(`${apiPrefix}/verifications`, verificationRoutes);
app.use(`${apiPrefix}/roster`, rosterRoutes);
app.use(`${apiPrefix}/placements`, placementRoutes);
app.use(`${apiPrefix}/interviews`, interviewRoutes);
app.use(`${apiPrefix}/consultants`, consultantRoutes);
app.use(`${apiPrefix}/alerts`, alertRoutes);

// 404 handler for undefined routes
app.use((req: Request, res: Response) => {
  logger.warn({ method: req.method, url: req.originalUrl }, '404 Not Found');
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
  });
});

// Sentry error handler must come BEFORE any other error handler
Sentry.setupExpressErrorHandler(app);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ err }, 'Server Error');

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.message,
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    code: err.code || 'SERVER_ERROR',
  });
});

// ─── Persistent-host startup (local dev, Render) ─────────────────────────────
// On Vercel we never call listen(); we export a serverless handler instead (below).
if (!process.env.VERCEL) {
  await ensureDB();
  const server = app.listen(ENV.PORT, () => {
    console.log('╔════════════════════════════════════════╗');
    console.log(`║  🚀 Server running on port ${ENV.PORT}       ║`);
    console.log(`║  📦 Environment: ${ENV.NODE_ENV.padEnd(18)}║`);
    console.log(`║  🌐 API: http://localhost:${ENV.PORT}${apiPrefix}  ║`);
    console.log('╚════════════════════════════════════════╝');
  });

  const gracefulShutdown = async (signal: string) => {
    logger.warn({ signal }, 'Signal received. Starting graceful shutdown...');
    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectDB();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// ─── Vercel serverless entry ─────────────────────────────────────────────────
// Ensure the (cached) DB connection is up, then hand the request to Express.
const serverlessHandler = async (req: Request, res: Response) => {
  try {
    await ensureDB();
  } catch (err) {
    logger.error({ err }, 'DB unavailable for request');
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Service temporarily unavailable, please retry', code: 'DB_UNAVAILABLE' }));
    return;
  }
  return (app as unknown as (req: Request, res: Response) => void)(req, res);
};

export default serverlessHandler;
