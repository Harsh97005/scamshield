import { Report } from '../models/Report.js';
import { findOrCreateIdentifier } from './identifier.service.js';
import { ApiError } from '../utils/apiResponse.js';

/**
 * Report Service.
 *
 * Owns all business logic for report submission and retrieval.
 *
 * Explicit scope boundaries for this sprint:
 *  - Does NOT modify Identifier.reputationScore (reputation pipeline: future sprint).
 *  - Does NOT increment User.reportCount or User.approvedReportCount (future sprint).
 *  - Does NOT perform or trigger admin moderation (future sprint).
 */

// ---------------------------------------------------------------------------
// submitReport
// API Contract §4.1  POST /reports
// ---------------------------------------------------------------------------

/**
 * Submit a new scam report.
 *
 * Flow:
 *  1. Resolve (or create) the Identifier document for the reported entity.
 *     findOrCreateIdentifier() normalizes the raw value and performs an
 *     atomic upsert — safe under concurrent load.
 *  2. Create the Report document with status 'pending'.
 *     reporter is sourced exclusively from req.user (set by authenticate
 *     middleware) — it is never accepted from the request body.
 *  3. Return report.toPublicJSON() — adminNotes is excluded.
 *
 * @param {{
 *   userId:          string,
 *   identifierType:  string,
 *   identifierValue: string,
 *   reportType:      string,
 *   title:           string,
 *   description:     string,
 *   evidenceUrls:    string[],
 *   incidentDate:    string | null | undefined,
 *   amountLost:      number | null | undefined,
 *   tags:            string[],
 * }} dto
 * @returns {Promise<object>} report.toPublicJSON()
 */
export async function submitReport({
  userId,
  identifierType,
  identifierValue,
  reportType,
  title,
  description,
  evidenceUrls,
  incidentDate,
  amountLost,
  tags,
}) {
  // Step 1 — resolve Identifier (normalize + atomic upsert).
  const identifier = await findOrCreateIdentifier({
    type:  identifierType,
    value: identifierValue,
  });

  // Step 2 — create Report, status defaults to 'pending' via schema default.
  const report = await Report.create({
    reporter:     userId,
    identifier:   identifier._id,
    reportType,
    title,
    description,
    evidenceUrls:  evidenceUrls  ?? [],
    incidentDate:  incidentDate  ?? null,
    amountLost:    amountLost    ?? null,
    tags:          tags          ?? [],
  });

  // Step 3 — return public shape (no adminNotes).
  return report.toPublicJSON();
}

// ---------------------------------------------------------------------------
// getReportById
// API Contract §4.2  GET /reports/:reportId
// ---------------------------------------------------------------------------

/**
 * Fetch a single report by its MongoDB _id.
 *
 * Public endpoint — returns toPublicJSON() (no adminNotes).
 * Admin detail view (with adminNotes) is handled by the admin service
 * in a future sprint.
 *
 * @param {string} reportId — MongoDB ObjectId string
 * @returns {Promise<object>} report.toPublicJSON()
 * @throws {ApiError} 404 NOT_FOUND if the report does not exist
 */
export async function getReportById(reportId) {
  const report = await Report.findById(reportId);

  if (!report) {
    throw new ApiError(404, 'NOT_FOUND', 'Report not found');
  }

  return report.toPublicJSON();
}
