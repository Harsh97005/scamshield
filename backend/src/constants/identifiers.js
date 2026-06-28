/**
 * Supported identifier types.
 * DB Architecture §2 — Identifiers collection.
 */
export const IDENTIFIER_TYPES = Object.freeze({
  PHONE:        'phone',
  EMAIL:        'email',
  UPI:          'upi',
  BANK_ACCOUNT: 'bank_account',
  WEBSITE:      'website',
  SOCIAL_MEDIA: 'social_media',
});

/**
 * Risk level enum — the ONLY UI-facing reputation field.
 * reputationScore (0–100) is internal; riskLevel is derived from it at write time.
 *
 * Three public values per finalized DB Architecture:
 *   unverified — insufficient report data to make a determination (score 0–39)
 *   caution    — some community reports; treat with care (score 40–69)
 *   high_risk  — strong signal of scam activity (score 70–100)
 */
export const RISK_LEVELS = Object.freeze({
  UNVERIFIED: 'unverified',
  CAUTION:    'caution',
  HIGH_RISK:  'high_risk',
});

/**
 * Internal reputation score bounds.
 * Score is an integer in [0, 100]; new identifiers start at 0.
 */
export const REPUTATION_SCORE = Object.freeze({
  MIN:     0,
  MAX:     100,
  DEFAULT: 0,
});

/**
 * Derive a riskLevel from a numeric reputationScore.
 * Single source of truth — used by the Identifier model pre-save hook
 * and the reputation scoring service.
 *
 * Thresholds:
 *   0–39  → unverified  (no meaningful signal yet)
 *   40–69 → caution     (emerging pattern)
 *   70–100 → high_risk  (confirmed scam signal)
 *
 * @param {number} score — integer 0–100
 * @returns {string} one of RISK_LEVELS
 */
export function deriveRiskLevel(score) {
  if (score >= 70) return RISK_LEVELS.HIGH_RISK;
  if (score >= 40) return RISK_LEVELS.CAUTION;
  return RISK_LEVELS.UNVERIFIED;
}
