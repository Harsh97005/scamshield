import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { ROLES } from '../constants/roles.js';
import * as adminReportController from '../controllers/adminReport.controller.js';

const router = Router();

/**
 * GET /api/v1/admin/reports
 * API Contract §8.1 — Admin only.
 *
 * Middleware chain:
 *   authenticate           — verifies Bearer token, attaches req.user
 *   authorize(ROLES.ADMIN) — rejects non-admin users with 403 FORBIDDEN
 *   getPendingReports      — returns paginated pending moderation queue
 *
 * Query params (all optional):
 *   page  {number} — page number, 1-indexed (default: 1)
 *   limit {number} — results per page, max 50 (default: 10)
 */
router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  adminReportController.getPendingReports,
);

/**
 * PATCH /api/v1/admin/reports/:reportId/approve
 * API Contract §8.3 — Admin only.
 *
 * Registered BEFORE GET /:reportId to prevent Express treating 'approve'
 * as a reportId param in a nested path collision.
 *
 * Transitions reportStatus from 'pending' → 'approved'.
 * Throws 409 CONFLICT if current status is not 'pending'.
 *
 * Body (all optional):
 *   adminNotes {string} — moderator note to attach to the report
 */
router.patch(
  '/:reportId/approve',
  authenticate,
  authorize(ROLES.ADMIN),
  adminReportController.approveReport,
);

/**
 * GET /api/v1/admin/reports/:reportId
 * API Contract §8.2 — Admin only.
 *
 * Registered AFTER PATCH /:reportId/approve and AFTER GET / so Express
 * matches more specific paths first.
 *
 * Returns full report detail including adminNotes.
 * Malformed ObjectId → 400 via global CastError handler (Sprint 1).
 * Non-existent reportId → 404 via ApiError thrown in service.
 */
router.get(
  '/:reportId',
  authenticate,
  authorize(ROLES.ADMIN),
  adminReportController.getPendingReportById,
);

export default router;
