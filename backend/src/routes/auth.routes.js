import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { signupSchema, loginSchema } from '../validators/auth.validator.js';
import * as authController from '../controllers/auth.controller.js';
import { ApiError, sendSuccess } from '../utils/apiResponse.js';

const router = Router();

const isDev = process.env.NODE_ENV === 'development';

/**
 * Rate limiter for signup.
 * Production — API Contract §0.8: 10 req / 15 min / IP.
 * Development — 100 req / 15 min / IP for frictionless local testing.
 */
const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new ApiError(429, 'RATE_LIMITED', 'Too many registration attempts. Please try again later.'));
  },
});

/**
 * Rate limiter for login.
 * Production — 5 req / 15 min / IP (brute-force protection).
 * Development — 100 req / 15 min / IP for frictionless local testing.
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new ApiError(429, 'RATE_LIMITED', 'Too many login attempts. Please try again later.'));
  },
});

/**
 * POST /api/v1/auth/signup — API Contract §1.1
 */
router.post(
  '/signup',
  signupRateLimiter,
  validate(signupSchema),
  authController.signup,
);

/**
 * POST /api/v1/auth/login — API Contract §1.4
 */
router.post(
  '/login',
  loginRateLimiter,
  validate(loginSchema),
  authController.login,
);

// ---------------------------------------------------------------------------
// TEMPORARY — Sprint 2 verification only. Remove after testing.
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/auth/me
 * Returns the decoded token payload attached by authenticate middleware.
 */
router.get('/me', authenticate, (req, res) => {
  return sendSuccess(res, { statusCode: 200, data: { user: req.user } });
});

export default router;
