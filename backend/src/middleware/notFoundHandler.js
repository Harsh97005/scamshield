import { ApiError } from '../utils/apiResponse.js';

/**
 * Catches any request that didn't match a defined route and forwards
 * a standardized 404 to the global error handler. Must be registered
 * after all routes and before errorHandler.
 */
export function notFoundHandler(req, res, next) {
  next(
    new ApiError(
      404,
      'NOT_FOUND',
      `Route ${req.method} ${req.originalUrl} not found`,
    ),
  );
}
