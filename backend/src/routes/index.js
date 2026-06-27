import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

/**
 * Route aggregator. Mounted under /api/{version} in app.js.
 * Feature route modules (auth, users, identifiers, reports, etc.)
 * will be added here in later sprints — Sprint 1 only wires health.
 */
router.use('/health', healthRoutes);

export default router;
