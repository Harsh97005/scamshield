import { ROLES } from '../constants/roles.js';
import { ApiError } from '../utils/apiResponse.js';

/**
 * Middleware factory that restricts a route to one or more allowed roles.
 * Must be used after `authenticate`, which populates `req.user`.
 *
 * API Contract §0.5 — Authorization Rules:
 *  - Public  : no middleware (open routes)
 *  - User    : authenticate only
 *  - Admin   : authenticate + authorize(ROLES.ADMIN)
 *
 * Returns 403 FORBIDDEN (not 404) for admin-scoped resources per API Contract §0.5:
 * "Authorization middleware rejects with 403 FORBIDDEN so legitimate admin
 *  tooling can distinguish 'not your resource' from 'endpoint doesn't exist for you.'"
 *
 * Usage:
 *   router.get('/admin/reports', authenticate, authorize(ROLES.ADMIN), handler);
 *   router.get('/users/me',      authenticate, handler);  // any authenticated role
 *
 * @param {...string} allowedRoles — one or more values from ROLES
 * @returns {import('express').RequestHandler}
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      // Guard against being called without authenticate upstream.
      return next(new ApiError(401, 'UNAUTHORIZED', 'Access token is required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    }

    return next();
  };
}
