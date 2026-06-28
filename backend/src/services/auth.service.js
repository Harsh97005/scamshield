import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { signAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/apiResponse.js';
import { AUTH } from '../constants/auth.js';
import { USER_STATUSES } from '../constants/roles.js';

/**
 * Auth Service.
 *
 * Owns all business logic for account creation and credential verification.
 * Password hashing lives here — the User model stores only the resulting hash.
 */

/**
 * Register a new user account.
 *
 * API Contract §1.1:
 *  - 409 CONFLICT if email already registered.
 *  - Returns user (public shape) + access token.
 *
 * @param {{ name: string, email: string, password: string }} dto
 * @returns {Promise<{ user: object, accessToken: string }>}
 */
export async function signup({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, 'CONFLICT', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, AUTH.BCRYPT_SALT_ROUNDS);

  const user = await User.create({ name, email, passwordHash });

  const accessToken = signAccessToken({
    userId: user._id.toString(),
    role: user.role,
    credibilityTier: user.credibilityTier,
  });

  return { user: user.toPublicJSON(), accessToken };
}

/**
 * Authenticate an existing user with email + password.
 *
 * API Contract §1.4:
 *  - 401 UNAUTHORIZED for unknown email OR wrong password — same message
 *    to prevent user enumeration.
 *  - 403 FORBIDDEN if account is suspended.
 *  - Returns user (public shape) + access token.
 *
 * @param {{ email: string, password: string }} dto
 * @returns {Promise<{ user: object, accessToken: string }>}
 */
export async function login({ email, password }) {
  // Fetch passwordHash explicitly — it is select:false by default.
  const user = await User.findOne({ email }).select('+passwordHash');

  // Always run bcrypt.compare to prevent timing-based user enumeration.
  // If user not found, compare against a dummy hash so the response time
  // is indistinguishable from a wrong-password attempt.
  const DUMMY_HASH = '$2b$12$invalidhashfortimingsafetypadding0000000000000000000000';
  const passwordMatch = await bcrypt.compare(
    password,
    user ? user.passwordHash : DUMMY_HASH,
  );

  if (!user || !passwordMatch) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password');
  }

  if (user.status === USER_STATUSES.SUSPENDED) {
    throw new ApiError(403, 'FORBIDDEN', 'Your account has been suspended');
  }

  const accessToken = signAccessToken({
    userId: user._id.toString(),
    role: user.role,
    credibilityTier: user.credibilityTier,
  });

  return { user: user.toPublicJSON(), accessToken };
}
