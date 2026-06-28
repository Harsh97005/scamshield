import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js'; // TEMPORARY — Sprint 2 verification only

const router = Router();

/**
 * Route aggregator. Mounted under /api/{version} in app.js.
 */
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes); // TEMPORARY — Sprint 2 verification only

export default router;
