import * as identifierService from '../services/identifier.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * Identifier Controller.
 *
 * Thin HTTP layer — no business logic.
 * Delegates entirely to the Identifier Service and maps results
 * to the standard response envelope via sendSuccess().
 *
 * Endpoints:
 *   GET /identifiers/search?type=&value=  → search
 *   GET /identifiers/:identifierId        → getById
 */

/**
 * GET /api/v1/identifiers/search
 * API Contract §3.1 — Public, no auth required.
 *
 * Query params are validated upstream by validate(searchIdentifierSchema).
 * Responds 200 with the identifier if found, or 200 with data:null if not found.
 * A null result is not a 404 — absence of a record is a valid, informative
 * response meaning the identifier has never been reported.
 */
export async function search(req, res, next) {
  try {
    const result = await identifierService.searchIdentifier({
      type:  req.query.type,
      value: req.query.value,
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/identifiers/:identifierId
 * API Contract §3.2 — Public, no auth required.
 *
 * Returns 404 via ApiError if the identifier does not exist (thrown by service).
 */
export async function getById(req, res, next) {
  try {
    const result = await identifierService.getIdentifierById(req.params.identifierId);

    return sendSuccess(res, {
      statusCode: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/identifiers/:identifierId/reports
 * API Contract §3.3 — Public, no auth required.
 *
 * Query params (all optional):
 *   page  {number} — page number, 1-indexed (default: 1)
 *   limit {number} — results per page, max 50 (default: 10)
 *
 * Returns 404 via ApiError if the identifier does not exist (thrown by service).
 * Malformed ObjectId → 400 via global CastError handler (Sprint 1).
 */
export async function getIdentifierReports(req, res, next) {
  try {
    const result = await identifierService.getIdentifierReports({
      identifierId: req.params.identifierId,
      page:         req.query.page,
      limit:        req.query.limit,
    });

    return sendSuccess(res, { statusCode: 200, data: result });
  } catch (err) {
    return next(err);
  }
}
