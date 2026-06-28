/**
 * User role enum.
 * Referenced by the User model, JWT payload, and authorization middleware.
 * DB Architecture: Users.role — 'user' | 'admin', default 'user'.
 */
export const ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
});

/**
 * Credibility tier enum.
 * Drives report weighting in the reputation scoring pipeline.
 * DB Architecture: Users.credibilityTier — 'new' | 'trusted' | 'flagged', default 'new'.
 */
export const CREDIBILITY_TIERS = Object.freeze({
  NEW: 'new',
  TRUSTED: 'trusted',
  FLAGGED: 'flagged',
});

/**
 * Account status enum.
 * No hard-delete — suspended is the terminal removal state per the
 * no-soft-delete philosophy (DB Architecture §Soft Delete Strategy).
 */
export const USER_STATUSES = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
});
