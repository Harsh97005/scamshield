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
 *   authenticate          — verifies Bearer token, attaches req.user
 *   authorize(ROLES.ADMIN) — rejects non-admin users with 403 FORBIDDEN
 *   getPendingReports     — returns paginated pending moderation queue
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

export default router;
