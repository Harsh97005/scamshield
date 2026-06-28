import * as authService from '../services/auth.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * Auth Controller.
 *
 * Thin HTTP layer — validates input upstream via the `validate` middleware,
 * delegates all business logic to the Auth Service, and maps results to
 * the standard response envelope.
 *
 * Endpoints covered (API Contract §1):
 *  POST /auth/signup  → signup
 *  POST /auth/login   → login
 */

/**
 * POST /auth/signup — API Contract §1.1
 */
export async function signup(req, res, next) {
  try {
    const { user, accessToken } = await authService.signup(req.body);

    return sendSuccess(res, {
      statusCode: 201,
      data: { user, accessToken },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /auth/login — API Contract §1.4
 */
export async function login(req, res, next) {
  try {
    const { user, accessToken } = await authService.login(req.body);

    return sendSuccess(res, {
      statusCode: 200,
      data: { user, accessToken },
    });
  } catch (err) {
    return next(err);
  }
}
