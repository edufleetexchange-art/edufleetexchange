/**
 * EduFleet Exchange Server
 * Main entry point for the backend API server
 */

import express, { Application, Request, Response } from 'express';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app: Application = express();

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

// Connect to database
await connectDB();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info('Created uploads directory');
}

// Serve static files (uploads)
app.use('/uploads', express.static(uploadsDir));

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

// Start server
const server = app.listen(ENV.PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log(`║  🚀 Server running on port ${ENV.PORT}       ║`);
  console.log(`║  📦 Environment: ${ENV.NODE_ENV.padEnd(18)}║`);
  console.log(`║  🌐 API: http://localhost:${ENV.PORT}${apiPrefix}  ║`);
  console.log('╚════════════════════════════════════════╝');
  console.log('\n📋 Registered API routes:');
  console.log(`  ${apiPrefix}/auth`);
  console.log(`  ${apiPrefix}/public          (GET /categories, GET /settings)`);
  console.log(`  ${apiPrefix}/vehicles`);
  console.log(`  ${apiPrefix}/admin           (GET/POST /categories, GET/PUT /settings)`);
  console.log(`  ${apiPrefix}/jobs`);
  console.log(`  ${apiPrefix}/suppliers`);
  console.log(`  ${apiPrefix}/notifications`);
  console.log(`  ${apiPrefix}/upload`);
  console.log(`  ${apiPrefix}/subscriptions`);
  console.log(`  ${apiPrefix}/marketing`);
  console.log(`  ${apiPrefix}/sales`);

  console.log(`  ${apiPrefix}/ads`);
  console.log(`  ${apiPrefix}/access`);
  console.log(`  ${apiPrefix}/crm`);
  console.log(`  ${apiPrefix}/accounts`);
  console.log(`  ${apiPrefix}/teachers`);
  console.log(`  ${apiPrefix}/institutes`);
  console.log(`  ${apiPrefix}/vendors`);
  console.log(`  ${apiPrefix}/reports`);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.warn({ signal }, 'Signal received. Starting graceful shutdown...');

  server.close(async () => {
    logger.info('HTTP server closed');

    await disconnectDB();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
