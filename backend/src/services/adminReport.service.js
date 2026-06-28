import { Report } from '../models/Report.js';
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
