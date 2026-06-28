import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { searchIdentifierSchema } from '../validators/identifier.validator.js';
import * as identifierController from '../controllers/identifier.controller.js';

const router = Router();

/**
 * GET /api/v1/identifiers/search?type=phone&value=+919876543210
 * API Contract §3.1 — Public, no auth required.
 *
 * validate() is applied against req.query for this route.
 * The validate middleware targets req.body by default; we wrap the schema
 * to parse req.query instead.
 */
router.get(
  '/search',
  (req, res, next) => {
    // Redirect validation to query params — body is empty for GET requests.
    req.body = req.query;
    next();
  },
  validate(searchIdentifierSchema),
  identifierController.search,
);

/**
 * GET /api/v1/identifiers/:identifierId
 * API Contract §3.2 — Public, no auth required.
 *
 * The service layer handles invalid / non-existent ObjectId with a 404 ApiError.
 * Mongoose CastError (malformed ObjectId) is caught by the global error handler
 * and mapped to 400 per Sprint 1's errorHandler middleware.
 */
router.get(
  '/:identifierId',
  identifierController.getById,
);

export default router;
