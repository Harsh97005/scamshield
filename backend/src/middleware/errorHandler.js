import { ApiError, sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

/**
 * Global error handler. Must be registered last, after all routes.
 *
 * - Known `ApiError` instances are passed straight through with their
 *   intended status/code/message.
 * - Mongoose validation/cast errors are mapped to a 400 VALIDATION_ERROR.
 * - Mongoose duplicate-key errors are mapped to a 409 CONFLICT.
 * - Anything else is treated as an unexpected 500 INTERNAL_ERROR, with
 *   the raw message hidden in production to avoid leaking internals.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const isProduction = env.NODE_ENV === 'production';

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details = [];

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ValidationError' && err.errors) {
    // Mongoose schema validation error
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      issue: e.message,
    }));
  } else if (err.name === 'CastError') {
    // Mongoose invalid ObjectId, etc.
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = `Invalid value for field '${err.path}'`;
    details = [{ field: err.path, issue: 'Malformed identifier' }];
  } else if (err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    code = 'CONFLICT';
    message = 'Resource already exists';
    details = Object.keys(err.keyValue || {}).map((field) => ({
      field,
      issue: 'Must be unique',
    }));
  } else {
    message = isProduction ? message : err.message;
  }

  const logPayload = { err, statusCode, code, path: req.originalUrl, method: req.method };

  if (statusCode >= 500) {
    logger.error(logPayload, 'Unhandled error');
  } else {
    logger.warn(logPayload, 'Request error');
  }

  return sendError(res, { statusCode, code, message, details });
}
