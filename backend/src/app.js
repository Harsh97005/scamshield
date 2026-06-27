import express from 'express';
import { env } from './config/env.js';
import { helmetMiddleware, corsMiddleware, baseRateLimiter } from './middleware/security.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  // Trust proxy (required for correct client IPs behind a load balancer,
  // and for express-rate-limit to key on the real client IP).
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmetMiddleware);

  // CORS
  app.use(corsMiddleware);

  // Base rate limiting (foundational guard; endpoint-specific limits layer on later)
  app.use(baseRateLimiter);

  // Request/response logging
  app.use(requestLogger);

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Versioned API routes
  app.use(`/api/${env.API_VERSION}`, routes);

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Global error handler — must be registered last
  app.use(errorHandler);

  return app;
}
