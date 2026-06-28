import { Identifier } from '../models/Identifier.js';
import { Report } from '../models/Report.js';
import { REPORT_STATUSES } from '../constants/reports.js';
import { normalizeIdentifier } from '../utils/identifierNormalizer.js';
import { ApiError } from '../utils/apiResponse.js';

/**
 * Identifier Service.
 *
 * Owns all business logic for identifier lookup and creation.
 *
 * Public functions (called by controllers):
 *   searchIdentifier()    — look up an identifier by type + raw value
 *   getIdentifierById()   — fetch a single identifier document by _id
 *
 * Internal function (used only by the future Reports service):
 *   findOrCreateIdentifier() — upsert an identifier record at report-submission time
 */

// ---------------------------------------------------------------------------
// Public — searchIdentifier
// API Contract §3.1  GET /identifiers/search?type=&value=
// ---------------------------------------------------------------------------

/**
 * Search for an existing identifier by type and raw user-supplied value.
 *
 * The raw value is normalized before the DB query so that variants
 * (e.g. "+91 98765-43210" vs "+919876543210") resolve to the same record.
 *
 * Behaviour:
 *  - Returns the public identifier document if found.
 *  - Returns null if no record exists — does NOT silently create one.
 *    Identifier creation is exclusively the domain of findOrCreateIdentifier(),
 *    which is only called during report submission.
 *
 * @param {{ type: string, value: string }} dto
 * @returns {Promise<object|null>} toPublicJSON() result or null
 */
export async function searchIdentifier({ type, value }) {
  const { normalizedValue } = normalizeIdentifier(type, value);

  // lean() is safe here — we only need the public fields for a search result.
  // toPublicJSON() is an instance method so we cannot use lean(); fetch as
  // a full Mongoose document instead.
  const identifier = await Identifier.findOne({
    identifierType: type,
    normalizedValue,
  });

  if (!identifier) {
    return null;
  }

  return identifier.toPublicJSON();
}

// ---------------------------------------------------------------------------
// Public — getIdentifierById
// API Contract §3.2  GET /identifiers/:identifierId
// ---------------------------------------------------------------------------

/**
 * Fetch a single identifier by its MongoDB _id.
 *
 * @param {string} identifierId — MongoDB ObjectId string
 * @returns {Promise<object>} toPublicJSON() result
 * @throws {ApiError} 404 if not found
 */
export async function getIdentifierById(identifierId) {
  const identifier = await Identifier.findById(identifierId);

  if (!identifier) {
    throw new ApiError(404, 'NOT_FOUND', 'Identifier not found');
  }

  return identifier.toPublicJSON();
}

// ---------------------------------------------------------------------------
// Internal — findOrCreateIdentifier
// Called exclusively by the Reports service during report submission.
// NOT exposed via any route.
// ---------------------------------------------------------------------------

/**
 * Find an existing identifier by type + raw value, or create it if it does
 * not yet exist. Returns the Mongoose document (not toPublicJSON()) so the
 * Reports service can reference `identifier._id` directly.
 *
 * Normalization is applied here so the Reports service never needs to call
 * the normalizer directly — a single entry point keeps normalization logic
 * centralized in the Identifier domain.
 *
 * Uses findOneAndUpdate with upsert to eliminate the TOCTOU race condition
 * that would exist with separate find + create calls under concurrent load.
 *
 * @param {{ type: string, value: string }} dto
 * @returns {Promise<import('mongoose').Document>} full Mongoose document
 */
export async function findOrCreateIdentifier({ type, value }) {
  const { normalizedValue, displayValue } = normalizeIdentifier(type, value);

  const identifier = await Identifier.findOneAndUpdate(
    { identifierType: type, normalizedValue },
    {
      $setOnInsert: {
        identifierType: type,
        normalizedValue,
        displayValue,
      },
    },
    {
      upsert: true,
      new: true,       // return the document after the operation
      setDefaultsOnInsert: true,
    },
  );

  return identifier;
}

// ---------------------------------------------------------------------------
// Public — getIdentifierReports
// API Contract §3.3  GET /identifiers/:identifierId/reports
// ---------------------------------------------------------------------------

/**
 * Fetch paginated approved reports for a given identifier.
 *
 * Only APPROVED reports are returned — pending, rejected, and info_requested
 * reports are internal moderation state and must never be exposed publicly.
 *
 * reporter is an ObjectId reference; it is NOT populated here so that
 * no user PII (email, name) is ever leaked through this public endpoint.
 * toPublicJSON() returns reporter as a raw ObjectId only.
 *
 * adminNotes is select:false on the Report schema — it is excluded
 * automatically without any explicit projection needed.
 *
 * Sort: createdAt descending (newest first), consistent with idx_createdAt_desc.
 *
 * @param {{
 *   identifierId: string,
 *   page:         number,
 *   limit:        number,
 * }} dto
 * @returns {Promise<{ reports: object[], pagination: object }>}
 * @throws {ApiError} 404 NOT_FOUND if the identifier does not exist
 */
export async function getIdentifierReports({ identifierId, page, limit }) {
  // Confirm the identifier exists before querying reports.
  // findById handles malformed ObjectId — Mongoose throws CastError which
  // the global error handler maps to 400.
  const identifier = await Identifier.findById(identifierId);

  if (!identifier) {
    throw new ApiError(404, 'NOT_FOUND', 'Identifier not found');
  }

  // Sanitize pagination inputs.
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip     = (pageNum - 1) * limitNum;

  const filter = {
    identifier:   identifier._id,
    reportStatus: REPORT_STATUSES.APPROVED,
  };

  const [total, reports] = await Promise.all([
    Report.countDocuments(filter),
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
  ]);

  return {
    reports: reports.map((r) => r.toPublicJSON()),
    pagination: {
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.ceil(total / limitNum),
      hasNext:    pageNum < Math.ceil(total / limitNum),
      hasPrev:    pageNum > 1,
    },
  };
}
