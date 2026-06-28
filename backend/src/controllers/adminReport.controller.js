import * as adminReportService from '../services/adminReport.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * Admin Report Controller.
 *
 * Thin HTTP layer — no business logic.
 * Delegates entirely to the Admin Report Service and maps results to the
 * standard response envelope via sendSuccess().
 *
 * All endpoints in this controller require authenticate + authorize(ROLES.ADMIN)
 * enforced at the route layer.
 *
 * Endpoints:
 *   GET /admin/reports  → getPendingReports
 */

/**
 * GET /api/v1/admin/reports
 * API Contract §8.1 — Admin only.
 *
 * Query params (all optional):
 *   page  {number} — page number, 1-indexed (default: 1)
 *   limit {number} — results per page, max 50 (default: 10)
 */
export async function getPendingReports(req, res, next) {
  try {
    const result = await adminReportService.getPendingReports({
      page:  req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, { statusCode: 200, data: result });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/admin/reports/:reportId
 * API Contract §8.2 — Admin only.
 *
 * Returns full report detail including adminNotes.
 * Malformed ObjectId → 400 via global CastError handler (Sprint 1).
 * Non-existent reportId → 404 via ApiError thrown in service.
 */
export async function getPendingReportById(req, res, next) {
  try {
    const result = await adminReportService.getPendingReportById(req.params.reportId);

    return sendSuccess(res, { statusCode: 200, data: result });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/v1/admin/reports/:reportId/approve
 * API Contract §8.3 — Admin only.
 *
 * Body (all optional):
 *   adminNotes {string} — moderator note to attach to the report
 */
export async function approveReport(req, res, next) {
  try {
    const result = await adminReportService.approveReport(
      req.params.reportId,
      req.body.adminNotes,
    );

    return sendSuccess(res, { statusCode: 200, data: result });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/v1/admin/reports/:reportId/reject
 * API Contract §8.4 — Admin only.
 *
 * Body (all optional):
 *   adminNotes {string} — moderator note to attach to the report
 */
export async function rejectReport(req, res, next) {
  try {
    const result = await adminReportService.rejectReport(
      req.params.reportId,
      req.body.adminNotes,
    );

    return sendSuccess(res, { statusCode: 200, data: result });
  } catch (err) {
    return next(err);
  }
}
