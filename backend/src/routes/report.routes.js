import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { submitReportSchema } from '../validators/report.validator.js';
import * as reportController from '../controllers/report.controller.js';

const router = Router();

/**
 * POST /api/v1/reports
 * API Contract §4.1 — Authenticated users only.
 *
 * Middleware chain:
 *   authenticate  — verifies Bearer token, attaches req.user
 *   validate      — validates and coerces req.body against submitReportSchema
 *   submit        — delegates to reportService.submitReport()
 */
router.post(
  '/',
  authenticate,
  validate(submitReportSchema),
  reportController.submit,
);

/**
 * GET /api/v1/reports/:reportId
 * API Contract §4.2 — Public, no auth required.
 *
 * Malformed ObjectId → 400 via global CastError handler (Sprint 1).
 * Non-existent reportId → 404 via ApiError thrown in service.
 */
router.get(
  '/:reportId',
  reportController.getById,
);

export default router;
