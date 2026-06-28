/**
 * Authentication constants.
 * API Contract §0.4: bcrypt cost factor ≥ 12, access token 15 min.
 * Refresh token implementation is deferred to a later sprint.
 */

export const AUTH = Object.freeze({
  ACCESS_TOKEN_EXPIRY: '15m',
  BCRYPT_SALT_ROUNDS: 12,
});
