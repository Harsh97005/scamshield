import { Report } from '../models/Report.js';
import { ApiError } from '../utils/apiResponse.js';
import { REPORT_STATUSES } from '../constants/reports.js';

/**
 * Admin Report Service.
 *
 * Owns business logic for admin-facing report moderation queries.
 * All functions in this service require the caller to be an authenticated
 * admin — enforcement is at the route layer via authenticate + authorize(ROLES.ADMIN).
 *
 * Scope for this sprint: read-only moderation queue.
 * Status transitions, reputation updates, and notifications are deferred.
 */

// ---------------------------------------------------------------------------
// getPendingReports
// API Contract §8.1  GET /admin/reports
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated list of pending reports for the admin moderation queue.
 *
 * Filtering:
 *  - reportStatus is always fixed to 'pending' — this endpoint is the
 *    entry point for the moderation queue; approved/rejected reports are
 *    handled by separate admin endpoints in future sprints.
 *
 * Population:
 *  - identifier: full document populated — admins need the displayValue
 *    and identifierType to understand what is being reported.
 *  - reporter: populated with name + email ONLY via an explicit field
 *    projection. passwordHash, refreshTokenHash (future), and all other
 *    internal fields are excluded at the query level, not just filtered
 *    after the fact.
 *
 * adminNotes is select:false on the Report schema — it is excluded
 * automatically. toAdminJSON() is not used here because adminNotes is
 * only relevant on single-report detail views (future sprint).
 *
 * Sort: createdAt ascending (oldest pending first) — ensures the queue
 * is worked FIFO and older reports are not starved.
 *
 * @param {{
 *   page:  number,
 *   limit: number,
 * }} dto
 * @returns {Promise<{ reports: object[], pagination: object }>}
 */
export async function getPendingReports({ page, limit }) {
  // Sanitize pagination inputs.
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip     = (pageNum - 1) * limitNum;

  const filter = { reportStatus: REPORT_STATUSES.PENDING };

  const [total, reports] = await Promise.all([
    Report.countDocuments(filter),
    Report.find(filter)
      .populate('identifier')                          // full Identifier document
      .populate('reporter', 'name email')              // name + email only — no passwordHash
      .sort({ createdAt: 1 })                          // oldest first (FIFO queue)
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

// ---------------------------------------------------------------------------
// getPendingReportById
// API Contract §8.2  GET /admin/reports/:reportId
// ---------------------------------------------------------------------------

/**
 * Fetch a single report by ID for admin review.
 *
 * Unlike the public getReportById() in report.service.js, this function:
 *  - Populates identifier and reporter (name + email only).
 *  - Explicitly selects adminNotes (+adminNotes) — admins are permitted
 *    to view moderator notes on individual reports.
 *  - Uses toAdminJSON() so adminNotes is included in the returned object.
 *
 * No status filtering — admins can fetch any report regardless of status
 * to support review of approved/rejected history as well as pending queue.
 *
 * reporter projection: 'name email' — passwordHash and all other User
 * fields are excluded at the query level.
 *
 * @param {string} reportId — MongoDB ObjectId string
 * @returns {Promise<object>} report.toAdminJSON() result
 * @throws {ApiError} 404 NOT_FOUND if the report does not exist
 */
export async function getPendingReportById(reportId) {
  const report = await Report.findById(reportId)
    .select('+adminNotes')
    .populate('identifier')
    .populate('reporter', 'name email');

  if (!report) {
    throw new ApiError(404, 'NOT_FOUND', 'Report not found');
  }

  return report.toAdminJSON();
}

// ---------------------------------------------------------------------------
// approveReport
// API Contract §8.3  PATCH /admin/reports/:reportId/approve
// ---------------------------------------------------------------------------

/**
 * Approve a pending report.
 *
 * Preconditions:
 *  - Report must exist — throws 404 NOT_FOUND otherwise.
 *  - reportStatus must be 'pending' — throws 409 CONFLICT for any other
 *    status so admins cannot double-approve or approve a rejected report.
 *
 * Mutations (this sprint only):
 *  - reportStatus → 'approved'
 *  - adminNotes   → saved if provided, left unchanged if omitted
 *
 * Explicitly deferred (future sprints):
 *  - Identifier.reputationScore update
 *  - Identifier.approvedReports counter increment
 *  - Identifier.lastReportedAt update
 *  - User.approvedReportCount increment
 *  - User credibilityTier recalculation
 *  - Notification to reporter
 *
 * @param {string}           reportId
 * @param {string|undefined} adminNotes — optional moderator note
 * @returns {Promise<object>} report.toAdminJSON()
 * @throws {ApiError} 404 NOT_FOUND  — report does not exist
 * @throws {ApiError} 409 CONFLICT   — report is not in 'pending' status
 */
export async function approveReport(reportId, adminNotes) {
  const report = await Report.findById(reportId).select('+adminNotes');

  if (!report) {
    throw new ApiError(404, 'NOT_FOUND', 'Report not found');
  }

  if (report.reportStatus !== REPORT_STATUSES.PENDING) {
    throw new ApiError(
      409,
      'CONFLICT',
      `Report cannot be approved because its current status is '${report.reportStatus}'. Only 'pending' reports can be approved.`,
    );
  }

  report.reportStatus = REPORT_STATUSES.APPROVED;

  if (adminNotes !== undefined && adminNotes !== null) {
    report.adminNotes = adminNotes;
  }

  await report.save();

  // Re-populate after save so the returned document mirrors what
  // getPendingReportById() would return — consistent shape for callers.
  await report.populate('identifier');
  await report.populate('reporter', 'name email');

  return report.toAdminJSON();
}

// ---------------------------------------------------------------------------
// rejectReport
// API Contract §8.4  PATCH /admin/reports/:reportId/reject
// ---------------------------------------------------------------------------

/**
 * Reject a pending report.
 *
 * Preconditions:
 *  - Report must exist — throws 404 NOT_FOUND otherwise.
 *  - reportStatus must be 'pending' — throws 409 CONFLICT for any other
 *    status so admins cannot double-reject or reject an approved report.
 *
 * Mutations (this sprint only):
 *  - reportStatus → 'rejected'
 *  - adminNotes   → saved if provided, left unchanged if omitted
 *
 * Explicitly deferred (future sprints):
 *  - Identifier.reputationScore update
 *  - User credibilityTier recalculation
 *  - Notification to reporter
 *
 * @param {string}           reportId
 * @param {string|undefined} adminNotes — optional moderator note
 * @returns {Promise<object>} report.toAdminJSON()
 * @throws {ApiError} 404 NOT_FOUND  — report does not exist
 * @throws {ApiError} 409 CONFLICT   — report is not in 'pending' status
 */
export async function rejectReport(reportId, adminNotes) {
  const report = await Report.findById(reportId).select('+adminNotes');

  if (!report) {
    throw new ApiError(404, 'NOT_FOUND', 'Report not found');
  }

  if (report.reportStatus !== REPORT_STATUSES.PENDING) {
    throw new ApiError(
      409,
      'CONFLICT',
      `Report cannot be rejected because its current status is '${report.reportStatus}'. Only 'pending' reports can be rejected.`,
    );
  }

  report.reportStatus = REPORT_STATUSES.REJECTED;

  if (adminNotes !== undefined && adminNotes !== null) {
    report.adminNotes = adminNotes;
  }

  await report.save();

  await report.populate('identifier');
  await report.populate('reporter', 'name email');

  return report.toAdminJSON();
}
