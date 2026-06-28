import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AUTH } from '../constants/auth.js';
import { ApiError } from './apiResponse.js';

/**
 * Sign a short-lived access token.
 *
 * Payload per API Contract §0.4:
 *   { sub: userId, role, credibilityTier, iat, exp }
 * PII beyond `sub` is intentionally excluded.
 *
 * @param {{ userId: string, role: string, credibilityTier: string }} payload
 * @returns {string} signed JWT
 */
export function signAccessToken({ userId, role, credibilityTier }) {
  return jwt.sign(
    { sub: userId, role, credibilityTier },
    env.JWT_ACCESS_SECRET,
    { expiresIn: AUTH.ACCESS_TOKEN_EXPIRY },
  );
}

/**
 * Verify an access token and return the decoded payload.
 * Throws ApiError 401 on expiry or invalid signature.
 *
 * @param {string} token
 * @returns {{ sub: string, role: string, credibilityTier: string, iat: number, exp: number }}
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (err) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired access token');
  }
}
