import { z } from 'zod';
import { REPORT_CATEGORIES } from '../constants/reports.js';
import { IDENTIFIER_TYPES } from '../constants/identifiers.js';

/**
 * Reusable identifier type enum schema.
 * Matches the one in identifier.validator.js; duplicated here to keep
 * each validator file self-contained and avoid a shared-import cycle.
 */
const identifierTypeSchema = z.enum(
  Object.values(IDENTIFIER_TYPES),
  {
    required_error: 'identifierType is required',
    invalid_type_error: `identifierType must be one of: ${Object.values(IDENTIFIER_TYPES).join(', ')}`,
  },
);

/**
 * Reusable report category enum schema.
 */
const reportTypeSchema = z.enum(
  Object.values(REPORT_CATEGORIES),
  {
    required_error: 'reportType is required',
    invalid_type_error: `reportType must be one of: ${Object.values(REPORT_CATEGORIES).join(', ')}`,
  },
);

/**
 * POST /reports — API Contract §4.1
 * Authenticated endpoint — requires a valid access token.
 *
 * The identifier is submitted as { identifierType, identifierValue } so
 * the Reports service can call findOrCreateIdentifier() and resolve the
 * Identifier _id before writing the Report document.
 * This avoids requiring callers to pre-look up or pre-create identifiers.
 *
 * Fields NOT accepted from the client:
 *   - reporter    (taken from req.user.userId set by authenticate middleware)
 *   - reportStatus (always starts as 'pending')
 *   - adminNotes  (admin-only, future sprint)
 */
export const submitReportSchema = z.object({
  /** The scam entity being reported — resolved to an Identifier _id by the service. */
  identifierType: identifierTypeSchema,

  identifierValue: z
    .string({ required_error: 'identifierValue is required' })
    .trim()
    .min(1, 'identifierValue cannot be empty')
    .max(256, 'identifierValue is too long'),

  reportType: reportTypeSchema,

  title: z
    .string({ required_error: 'title is required' })
    .trim()
    .min(10, 'title must be at least 10 characters')
    .max(120, 'title must be at most 120 characters'),

  description: z
    .string({ required_error: 'description is required' })
    .trim()
    .min(30, 'description must be at least 30 characters')
    .max(5000, 'description must be at most 5000 characters'),

  /** Optional — absence means no evidence URLs at submission time. */
  evidenceUrls: z
    .array(
      z.string().url('Each evidenceUrl must be a valid URL').max(2048, 'URL is too long'),
    )
    .max(10, 'A maximum of 10 evidence URLs are allowed')
    .default([]),

  /** Optional — ISO 8601 date string; must not be in the future. */
  incidentDate: z
    .string()
    .datetime({ message: 'incidentDate must be a valid ISO 8601 datetime string' })
    .refine(
      (val) => new Date(val) <= new Date(),
      { message: 'incidentDate cannot be in the future' },
    )
    .optional()
    .nullable(),

  /** Optional — monetary loss in INR; must be non-negative. */
  amountLost: z
    .number({ invalid_type_error: 'amountLost must be a number' })
    .nonnegative('amountLost cannot be negative')
    .optional()
    .nullable(),

  /** Optional — lowercase tags, max 10, each max 30 chars. */
  tags: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .min(1, 'Each tag must be at least 1 character')
        .max(30, 'Each tag must be at most 30 characters')
        .regex(/^[a-z0-9_]+$/, 'Tags may only contain lowercase letters, numbers, and underscores'),
    )
    .max(10, 'A maximum of 10 tags are allowed')
    .default([]),
});
