import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';

const router = Router();

/**
 * Route aggregator. Mounted under /api/{version} in app.js.
 */
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

export default router;
