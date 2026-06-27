/**
 * Custom application error class.
 * Thrown anywhere in the request lifecycle (middleware, controllers,
 * services) and caught by the global error handler, which maps it
 * to the standard error envelope.
 */
export class ApiError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Send a successful response in the standard envelope:
 * { success: true, data, meta? }
 */
export function sendSuccess(res, { statusCode = 200, data = null, meta } = {}) {
  const body = { success: true, data };

  if (meta !== undefined) {
    body.meta = meta;
  }

  return res.status(statusCode).json(body);
}

/**
 * Send an error response in the standard envelope:
 * { success: false, error: { code, message, details } }
 *
 * Intended for use by the global error handler — not for direct use
 * in controllers, which should `throw new ApiError(...)` instead.
 */
export function sendError(res, { statusCode = 500, code = 'INTERNAL_ERROR', message, details = [] }) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message, details },
  });
}
