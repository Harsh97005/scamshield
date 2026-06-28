// TEMPORARY — Sprint 2 verification only. Remove after testing.

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

/**
 * GET /api/v1/admin/test
 * Verifies that authenticate + authorize(admin) middleware chain works correctly.
 * Returns 200 for admins, 401 for unauthenticated, 403 for non-admin users.
 */
router.get('/test', authenticate, authorize(ROLES.ADMIN), (req, res) => {
  return sendSuccess(res, {
    statusCode: 200,
    data: { message: 'Admin access verified', user: req.user },
  });
});

export default router;