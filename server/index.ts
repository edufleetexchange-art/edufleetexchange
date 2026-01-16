/**
 * EduFleet Exchange Server
 * Main entry point for the backend API server
 */

import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables first
dotenv.config();

// Import configurations
import { ENV, connectDB, disconnectDB, configureApp } from './config/index.js';

// Import routes
import authRoutes from './routes/auth.js';
import vehicleRoutes from './routes/vehicles.js';
import adminRoutes from './routes/admin.js';
import jobRoutes from './routes/jobs.js';
import supplierRoutes from './routes/suppliers.js';
import notificationRoutes from './routes/notifications.js';
import uploadRoutes from './routes/upload.js';
import subscriptionRoutes from './routes/subscriptions.js';
import userRoutes from './routes/users.js';
import adRoutes from './routes/ads.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app: Application = express();

// Apply app configuration (middleware, security headers, etc.)
configureApp(app);

// Connect to database
await connectDB();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✓ Created uploads directory');
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
app.use(`${apiPrefix}/vehicles`, vehicleRoutes);
app.use(`${apiPrefix}/admin`, adminRoutes);
app.use(`${apiPrefix}/jobs`, jobRoutes);
app.use(`${apiPrefix}/suppliers`, supplierRoutes);
app.use(`${apiPrefix}/notifications`, notificationRoutes);
app.use(`${apiPrefix}/upload`, uploadRoutes);
app.use(`${apiPrefix}/subscriptions`, subscriptionRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/ads`, adRoutes);

// 404 handler for undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.path,
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Server Error:', err);
  
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
const server = app.listen(5000, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log(`║  🚀 Server running on port ${ENV.PORT}       ║`);
  console.log(`║  📦 Environment: ${ENV.NODE_ENV.padEnd(18)}║`);
  console.log(`║  🌐 API: http://localhost:${ENV.PORT}${apiPrefix}  ║`);
  console.log('╚════════════════════════════════════════╝');
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n⚠ ${signal} received. Starting graceful shutdown...`);
  
  server.close(async () => {
    console.log('✓ HTTP server closed');
    
    await disconnectDB();
    
    console.log('✓ Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;