/**
 * Express App Configuration
 * Configures middleware and app-level settings
 */

import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { corsConfig } from './cors.js';
import { ENV, isProduction } from './environment.js';

export const configureApp = (app: Application): void => {
  // Trust proxy in production (for secure cookies behind reverse proxy)
  if (isProduction) {
    app.set('trust proxy', 1);
  }

  // CORS middleware
  app.use(cors(corsConfig));

  // Body parsing middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Cookie parsing middleware
  app.use(cookieParser());

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Request logging in development
  if (!isProduction) {
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }
};

export default configureApp;
