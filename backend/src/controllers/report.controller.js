import * as reportService from '../services/report.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * Report Controller.
 *
 * Thin HTTP layer — no business logic.
 * Delegates entirely to the Report Service and maps results to the
 * standard response envelope via sendSuccess().
 *
 * Endpoints:
 *   POST /reports       → submit
 *   GET  /reports/me    → getMyReports
 *   GET  /reports/:reportId → getById
 */

/**
 * POST /api/v1/reports
 * API Contract §4.1 — Requires authentication.
 *
 * reporter is sourced from req.user.userId (set by authenticate middleware).
 * Validated body fields are forwarded directly to the service.
 */
export async function submit(req, res, next) {
  try {
    const report = await reportService.submitReport({
      userId:          req.user.userId,
      identifierType:  req.body.identifierType,
      identifierValue: req.body.identifierValue,
      reportType:      req.body.reportType,
      title:           req.body.title,
      description:     req.body.description,
      evidenceUrls:    req.body.evidenceUrls,
      incidentDate:    req.body.incidentDate,
      amountLost:      req.body.amountLost,
      tags:            req.body.tags,
    });

    return sendSuccess(res, { statusCode: 201, data: report });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/reports/me
 * API Contract §4.3 — Requires authentication.
 *
 * userId sourced from req.user.userId — never from query or body.
 * page, limit, status sourced from req.query.
 */
export async function getMyReports(req, res, next) {
  try {
    const { page, limit, status } = req.query;

    const result = await reportService.getMyReports({
      userId: req.user.userId,
      page,
      limit,
      status,
    });

    return sendSuccess(res, { statusCode: 200, data: result });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/reports/:reportId
 * API Contract §4.2 — Public, no auth required.
 *
 * Returns 404 via ApiError if the report does not exist (thrown by service).
 * Mongoose CastError on a malformed ObjectId is handled by the global
 * error handler (Sprint 1) and mapped to 400 automatically.
 */
export async function getById(req, res, next) {
  try {
    const report = await reportService.getReportById(req.params.reportId);

    return sendSuccess(res, { statusCode: 200, data: report });
  } catch (err) {
    return next(err);
  }
}
