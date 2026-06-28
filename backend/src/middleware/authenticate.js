import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/apiResponse.js';

/**
 * Middleware that enforces a valid access token on protected routes.
 *
 * Reads the Bearer token from the Authorization header, verifies it,
 * and attaches the decoded payload to `req.user` so downstream
 * controllers and service calls have access to `userId`, `role`,
 * and `credibilityTier` without re-querying the database.
 *
 * API Contract §0.4 — access token payload: { sub, role, credibilityTier, iat, exp }
 *
 * Throws:
 *  - 401 UNAUTHORIZED — header missing, malformed, or token invalid/expired.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Access token is required'));
  }

  const token = authHeader.slice(7); // strip 'Bearer '

  try {
    const payload = verifyAccessToken(token);

    req.user = {
      userId: payload.sub,
      role: payload.role,
      credibilityTier: payload.credibilityTier,
    };

    return next();
  } catch (err) {
    // verifyAccessToken already throws ApiError 401; forward it directly.
    return next(err);
  }
}
