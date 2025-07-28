import express from 'express';
import { getAdminAnalytics } from './adminController.js';
import { protect, authorize } from '../../middelWares/authMiddleware.js';

const router = express.Router();

// GET /api/admin/analytics
// we must add protected
router.get('/analytics', getAdminAnalytics);
// router.get('/analytics', protect , authorize('admin'),  getAdminAnalytics);

export default router; 