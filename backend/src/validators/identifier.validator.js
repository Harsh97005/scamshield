import { z } from 'zod';
import { IDENTIFIER_TYPES } from '../constants/identifiers.js';

/**
 * Reusable enum schema for identifier type.
 * Single source of truth — derived from IDENTIFIER_TYPES constant.
 */
const identifierTypeSchema = z.enum(
  Object.values(IDENTIFIER_TYPES),
  {
    required_error: 'identifierType is required',
    invalid_type_error: `identifierType must be one of: ${Object.values(IDENTIFIER_TYPES).join(', ')}`,
  },
);

/**
 * GET /identifiers/search?type=phone&value=9876543210
 * API Contract §3.1 — Public endpoint, no auth required.
 *
 * Validates query parameters only; normalization happens in the service layer.
 */
export const searchIdentifierSchema = z.object({
  type: identifierTypeSchema,

  value: z
    .string({ required_error: 'value is required' })
    .trim()
    .min(1, 'value cannot be empty')
    .max(256, 'value is too long'),
});

/**
 * POST /identifiers
 * API Contract §3 — Authenticated endpoint (user or admin).
 *
 * Accepts raw user input; the service layer calls normalizeIdentifier()
 * before any DB write so normalizedValue is never submitted directly.
 *
 * Type-specific length constraints are deliberately loose here — the
 * normalizer performs structural validation (E.164, VPA format, IFSC, etc.)
 * and will throw a 400 ApiError for structurally invalid inputs.
 */
export const createIdentifierSchema = z.object({
  identifierType: identifierTypeSchema,

  value: z
    .string({ required_error: 'value is required' })
    .trim()
    .min(1, 'value cannot be empty')
    .max(256, 'value is too long'),
});
