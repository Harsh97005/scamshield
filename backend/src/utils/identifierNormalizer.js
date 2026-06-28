import { IDENTIFIER_TYPES } from '../constants/identifiers.js';
import { ApiError } from './apiResponse.js';

/**
 * Identifier Normalizer.
 *
 * Converts raw user-supplied identifier strings into a canonical
 * `normalizedValue` (used for deduplication + DB lookups) and a
 * human-readable `displayValue` (shown in the UI).
 *
 * India-only platform assumption
 * ──────────────────────────────
 * ScamShield is explicitly an India-focused platform (PRD §1 — "community-driven
 * scam intelligence platform for India"). Phone normalisation therefore operates
 * under the documented assumption that all phone numbers are Indian numbers.
 * This assumption is surfaced here, not hidden, so it can be revisited if the
 * platform expands internationally.
 *
 * Rules per type
 * ──────────────
 * PHONE  (India-only, documented assumption)
 *   Input MUST include a country code, either as a leading "+" or as the
 *   two-digit prefix "91". Bare 10-digit numbers WITHOUT any country-code
 *   signal are REJECTED with a clear error message instructing the caller
 *   to supply "+91". This prevents silently mis-labelling a number from
 *   another country as Indian.
 *
 *   Accepted forms (all produce the same normalizedValue):
 *     +91 98765-43210   → +919876543210
 *     +919876543210     → +919876543210
 *     919876543210      → +919876543210   (leading 91, no +)
 *
 *   Rejected forms:
 *     9876543210        → 400: "Include country code, e.g. +91 9876543210"
 *
 *   normalizedValue : +919876543210
 *   displayValue    : +91 98765 43210
 *
 * EMAIL
 *   Trim + lowercase. No sub-address stripping (preserves provider-specific dots).
 *   normalizedValue : harsh@gmail.com
 *   displayValue    : harsh@gmail.com
 *
 * UPI
 *   Trim + lowercase. UPI VPAs are case-insensitive per NPCI spec.
 *   normalizedValue : harsh@paytm
 *   displayValue    : harsh@paytm
 *
 * BANK_ACCOUNT
 *   Trim + uppercase + collapse internal whitespace.
 *   Stored as "ACCOUNTNUMBER|IFSC" so both parts travel together.
 *   normalizedValue : 123456789012|SBIN0001234
 *   displayValue    : 123456789012 | SBIN0001234
 *
 * WEBSITE
 *   Lowercase → strip protocol → strip www. → strip trailing slash → strip path/query.
 *   Deduplicates across http/https/www variants.
 *   normalizedValue : example.com
 *   displayValue    : example.com
 *
 * SOCIAL_MEDIA
 *   Trim + lowercase. Stored as "platform:handle".
 *   normalizedValue : instagram:harsh_official
 *   displayValue    : instagram:harsh_official
 */

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/**
 * @param {string} raw
 * @returns {{ normalizedValue: string, displayValue: string }}
 */
export function normalizePhone(raw) {
  const trimmed = raw.trim();
  const digitsOnly = trimmed.replace(/[^\d]/g, '');

  let e164;

  if (trimmed.startsWith('+91') && digitsOnly.length === 12) {
    // Explicit +91 country code with 10-digit subscriber number — canonical form
    e164 = `+${digitsOnly}`;
  } else if (!trimmed.startsWith('+') && digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    // Country code present as leading "91" without the + sign (e.g. "919876543210")
    e164 = `+${digitsOnly}`;
  } else if (digitsOnly.length === 10) {
    // Bare 10-digit number with no country code signal — REJECT.
    // ScamShield is India-only (PRD §1), but silently prefixing +91 would
    // mis-label a non-Indian number if one ever arrives. Callers must be
    // explicit so the data is trustworthy.
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Phone number must include a country code (e.g. +91 9876543210)',
    );
  } else {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Invalid Indian phone number. Expected format: +91 XXXXX XXXXX',
    );
  }

  // Display: +91 XXXXX XXXXX
  const display = `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;

  return { normalizedValue: e164, displayValue: display };
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/**
 * @param {string} raw
 * @returns {{ normalizedValue: string, displayValue: string }}
 */
export function normalizeEmail(raw) {
  const normalized = raw.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid email address format');
  }

  return { normalizedValue: normalized, displayValue: normalized };
}

// ---------------------------------------------------------------------------
// UPI
// ---------------------------------------------------------------------------

/**
 * @param {string} raw
 * @returns {{ normalizedValue: string, displayValue: string }}
 */
export function normalizeUPI(raw) {
  const normalized = raw.trim().toLowerCase();

  // Basic VPA format: localpart@handle
  if (!/^[a-z0-9.\-_+]+@[a-z0-9]+$/.test(normalized)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid UPI VPA format');
  }

  return { normalizedValue: normalized, displayValue: normalized };
}

// ---------------------------------------------------------------------------
// Bank Account
// ---------------------------------------------------------------------------

/**
 * Expects input as "accountNumber|IFSC" or "accountNumber IFSC".
 * @param {string} raw
 * @returns {{ normalizedValue: string, displayValue: string }}
 */
export function normalizeBankAccount(raw) {
  // Accept pipe or whitespace as delimiter
  const parts = raw.trim().toUpperCase().split(/[|\s]+/);

  if (parts.length !== 2) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Bank account must be supplied as "accountNumber|IFSC" (e.g. 123456789012|SBIN0001234)',
    );
  }

  const [accountNumber, ifsc] = parts;

  if (!/^\d{9,18}$/.test(accountNumber)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid bank account number (9–18 digits)');
  }

  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid IFSC code format (e.g. SBIN0001234)');
  }

  const normalizedValue = `${accountNumber}|${ifsc}`;
  const displayValue    = `${accountNumber} | ${ifsc}`;

  return { normalizedValue, displayValue };
}

// ---------------------------------------------------------------------------
// Website
// ---------------------------------------------------------------------------

/**
 * @param {string} raw
 * @returns {{ normalizedValue: string, displayValue: string }}
 */
export function normalizeWebsite(raw) {
  let url = raw.trim().toLowerCase();

  // Strip protocol
  url = url.replace(/^https?:\/\//, '');

  // Strip www.
  url = url.replace(/^www\./, '');

  // Strip trailing slash
  url = url.replace(/\/$/, '');

  // Strip path, query, fragment — keep only host
  const hostOnly = url.split('/')[0].split('?')[0].split('#')[0];

  if (!hostOnly || !/^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/.test(hostOnly)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid website domain format');
  }

  return { normalizedValue: hostOnly, displayValue: hostOnly };
}

// ---------------------------------------------------------------------------
// Social Media
// ---------------------------------------------------------------------------

/**
 * Expects input as "platform:handle" (e.g. "instagram:harsh_official").
 * @param {string} raw
 * @returns {{ normalizedValue: string, displayValue: string }}
 */
export function normalizeSocialMedia(raw) {
  const normalized = raw.trim().toLowerCase();
  const colonIndex = normalized.indexOf(':');

  if (colonIndex === -1) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Social media identifier must be in "platform:handle" format (e.g. instagram:harsh_official)',
    );
  }

  const platform = normalized.slice(0, colonIndex).trim();
  const handle   = normalized.slice(colonIndex + 1).trim();

  if (!platform || !handle) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Both platform and handle are required');
  }

  const value = `${platform}:${handle}`;
  return { normalizedValue: value, displayValue: value };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Normalize any identifier type.
 * Returns `{ normalizedValue, displayValue }` ready for DB persistence.
 *
 * @param {string} type  — one of IDENTIFIER_TYPES
 * @param {string} value — raw user input
 * @returns {{ normalizedValue: string, displayValue: string }}
 */
export function normalizeIdentifier(type, value) {
  switch (type) {
    case IDENTIFIER_TYPES.PHONE:        return normalizePhone(value);
    case IDENTIFIER_TYPES.EMAIL:        return normalizeEmail(value);
    case IDENTIFIER_TYPES.UPI:          return normalizeUPI(value);
    case IDENTIFIER_TYPES.BANK_ACCOUNT: return normalizeBankAccount(value);
    case IDENTIFIER_TYPES.WEBSITE:      return normalizeWebsite(value);
    case IDENTIFIER_TYPES.SOCIAL_MEDIA: return normalizeSocialMedia(value);
    default:
      throw new ApiError(400, 'VALIDATION_ERROR', `Unsupported identifier type: ${type}`);
  }
}
