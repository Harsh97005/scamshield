import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiResponse.js';

/**
 * Helmet — sets a battery of security-related HTTP headers.
 * Defaults are sufficient for a JSON API (no inline scripts/styles served).
 */
export const helmetMiddleware = helmet();

/**
 * CORS — restricts cross-origin access to the explicit allowlist
 * configured via CORS_ALLOWED_ORIGINS. Credentials enabled since
 * future auth flows rely on an httpOnly refresh-token cookie.
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser tools (no Origin header) and explicitly allowlisted origins.
    if (!origin || env.CORS_ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new ApiError(403, 'FORBIDDEN', 'Origin not allowed by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
});

/**
 * Base, app-wide rate limiter. This is a general abuse ceiling applied
 * to every request as a foundational guard. Tighter, endpoint-specific
 * limits (auth, search, report submission) are layered on top of this
 * in their respective feature modules in later sprints — not defined here.
 */
export const baseRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'));
  },
});
