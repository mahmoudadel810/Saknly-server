import express from 'express';
import { getAdminAnalytics } from './adminController.js';
import { protect, admin } from '../../middelWares/authMiddleware.js';

const router = express.Router();

// GET /api/saknly/v1/admin/analytics (admin only)
router.get('/analytics', protect, admin, getAdminAnalytics);

export default router;
