import { Router } from "express";


import * as propertyController from './propertyController.js';
import { validation } from '../../middelWares/validation.js';
import { PropertyValidator } from './propertyValidation.js';
import { authorize, protect } from '../../middelWares/authMiddleware.js';
import { createUploader, allowedMimeTypes } from '../../utils/multer.js';

const uploader = createUploader([
    ...allowedMimeTypes.image,
    ...allowedMimeTypes.video
]);
const router = Router();


router.get('/allProperties', propertyController.getAllProperties);
router.get('/propertyDetails/:_id', propertyController.getPropertyDetails);
router.get('/search', propertyController.searchProperties);
router.get('/featured', propertyController.getMostViewedProperties);
router.get('/similar/:id', propertyController.getSimilarProperties);


router.post(
    '/addProperty',
    protect,

    // authorize('user','admin', 'agent'),
    uploader.array('media', 20),
    validation(PropertyValidator),
    propertyController.addProperty
);

router.put(
    '/updateProperty/:id',
    protect,
    authorize('admin', 'agent'),
    uploader.array('newMedia', 20),
    validation(PropertyValidator),
    propertyController.updateProperty
);

router.delete(
    '/deleteProperty/:id',
    protect,
    authorize('admin', 'agent'), 
    propertyController.deleteProperty
);

router.get('/getMostViewedProperties',protect,authorize('admin', 'agent'), propertyController.getMostViewedProperties);


// Admin: Get all pending properties
router.get(
    '/pending',
    // protect,
    // authorize('admin'),
    propertyController.getPendingProperties
);

// Admin: Approve property
router.put(
    '/:id/approve',
    // protect,
    // authorize('admin'),
    propertyController.approveProperty
);

// Admin: Deny property
router.delete(
    '/:id/deny',
    // protect,
    // authorize('admin'),
    propertyController.denyProperty
);

router.get(
    '/myProperties',
    protect,
    authorize('user','admin','agent'),
    propertyController.getUserProperties
);

// Wishlist/Favorites endpoints
router.post(
    '/:id/favorite',
    protect,
    propertyController.addToFavorites
);

router.delete(
    '/:id/favorite',
    protect,
    propertyController.removeFromFavorites
);

router.get(
    '/:id/favorite',
    protect,
    propertyController.checkFavoriteStatus
);










export default router;