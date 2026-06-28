import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js'; // TEMPORARY — Sprint 2 verification only
import identifierRoutes from './identifier.routes.js';
import reportRoutes from './report.routes.js';
import adminReportRoutes from './adminReport.routes.js';

const router = Router();

/**
 * Route aggregator. Mounted under /api/{version} in app.js.
 */
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);              // TEMPORARY — Sprint 2 verification only
router.use('/admin/reports', adminReportRoutes);
router.use('/identifiers', identifierRoutes);
router.use('/reports', reportRoutes);

export default router;
