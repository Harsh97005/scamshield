import { Router } from 'express';
import mongoose from 'mongoose';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

const MONGOOSE_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * GET /api/v1/health
 * Liveness/readiness probe. Reports process uptime and current
 * MongoDB connection state. No auth, no business logic.
 */
router.get('/', (req, res) => {
  const dbState = MONGOOSE_STATES[mongoose.connection.readyState] || 'unknown';

  return sendSuccess(res, {
    statusCode: 200,
    data: {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: dbState,
    },
  });
});

export default router;
