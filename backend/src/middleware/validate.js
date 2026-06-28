import { ZodError } from 'zod';
import { ApiError } from '../utils/apiResponse.js';

/**
 * Express middleware factory that validates `req.body` against a Zod schema.
 *
 * On success: replaces `req.body` with the parsed (coerced + stripped) output
 * so downstream handlers always receive clean, typed data.
 *
 * On failure: maps ZodError issues to the standard API error envelope shape
 * and forwards a 400 VALIDATION_ERROR ApiError to the global error handler.
 *
 * Usage:
 *   router.post('/signup', validate(signupSchema), authController.signup);
 *
 * @param {import('zod').ZodSchema} schema
 * @returns {import('express').RequestHandler}
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        issue: issue.message,
      }));

      return next(
        new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', details),
      );
    }

    req.body = result.data;
    return next();
  };
}
