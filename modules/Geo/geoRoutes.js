import { Router } from 'express';
import { protect } from '../../middelWares/authMiddleware.js';
import { validation } from '../../middelWares/validation.js';
import * as geo from './geoController.js';
import { geoRateLimit } from './geoRateLimit.js';
import { reverseValidator, searchValidator } from './geoValidation.js';

const router = Router();

// Signed-in only (listing owners use them), and rate limited: every call is billed by GeoLink.
router.get('/search', protect, geoRateLimit, validation(searchValidator), geo.search);
router.get('/reverse', protect, geoRateLimit, validation(reverseValidator), geo.reverse);

export default router;
