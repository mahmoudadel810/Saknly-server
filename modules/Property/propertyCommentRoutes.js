import { Router } from 'express';
import { getCommentsByProperty, addComment } from './propertyCommentController.js';
import { protect } from '../../middelWares/authMiddleware.js';

const router = Router();

// جلب كل التعليقات لعقار معين
router.get('/:propertyId', getCommentsByProperty);

// إضافة تعليق جديد (يتطلب تسجيل الدخول)
router.post('/:propertyId', protect, addComment);

export default router; 