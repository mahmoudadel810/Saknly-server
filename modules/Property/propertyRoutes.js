import { Router } from "express";


import * as propertyController from './propertyController.js';
import { validation } from '../../middelWares/validation.js';
import { PropertyValidator, UpdatePropertyValidator } from './propertyValidation.js';
import { admin, optionalAuth, protect } from '../../middelWares/authMiddleware.js';
import { createUploader, allowedMimeTypes } from '../../utils/multer.js';
import { fileUploadLimiter } from '../../utils/rateLimiter.js';

const uploader = createUploader([
    ...allowedMimeTypes.image,
    ...allowedMimeTypes.video
]);
const router = Router();


// Specific routes first (before parameterized routes)
router.get('/allProperties', propertyController.getAllProperties);
router.get('/propertyDetails/:_id', optionalAuth, propertyController.getPropertyDetails);
router.get('/search', propertyController.searchProperties);
router.get('/featured', propertyController.getMostViewedProperties);
router.get('/similar/:id', propertyController.getSimilarProperties);
router.get('/getMostViewedProperties', protect, admin, propertyController.getMostViewedProperties);
router.get('/pending', protect, admin, propertyController.getPendingProperties);
router.get('/myProperties', protect, propertyController.getUserProperties);

// Specific POST routes first
router.post(
    '/addProperty',
    protect,
    fileUploadLimiter,
    uploader.any(), // Accept any field name for files
    validation(PropertyValidator),
    propertyController.addProperty
);

// Specific PUT routes first (owner or admin - checked in the controller)
router.put(
    '/updateProperty/:id',
    protect,
    fileUploadLimiter,
    uploader.array('newImages', 8),
    validation(UpdatePropertyValidator),
    propertyController.updateProperty
);

// Specific DELETE routes first (owner or admin - checked in the controller)
router.delete(
    '/deleteProperty/:id',
    protect,
    propertyController.deleteProperty
);

// Parameterized routes last (to avoid catching specific routes) - admin only
router.put('/:id/approve', protect, admin, propertyController.approveProperty);
router.delete('/:id/deny', protect, admin, propertyController.denyProperty);

// Wishlist/Favorites endpoints (parameterized routes last)
router.post('/:id/favorite', protect, propertyController.addToFavorites);
router.delete('/:id/favorite', protect, propertyController.removeFromFavorites);
router.get('/:id/favorite', protect, propertyController.checkFavoriteStatus);


export default router;
