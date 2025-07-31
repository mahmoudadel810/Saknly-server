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

console.log('=== PROPERTY ROUTES INITIALIZED ===');
console.log('Router created for property routes');

// Test route to verify router is working
router.get('/test', (req, res) => {
    console.log('=== TEST ROUTE HIT ===');
    res.json({ message: 'Property router is working' });
});


// Specific routes first (before parameterized routes)
router.get('/allProperties', propertyController.getAllProperties);
router.get('/propertyDetails/:_id', propertyController.getPropertyDetails);
router.get('/search', propertyController.searchProperties);
router.get('/featured', propertyController.getMostViewedProperties);
router.get('/similar/:id', propertyController.getSimilarProperties);
router.get('/getMostViewedProperties', protect, authorize('admin', 'agent'), propertyController.getMostViewedProperties);
router.get('/pending', propertyController.getPendingProperties);
router.get('/myProperties', protect, authorize('user','admin','agent'), propertyController.getUserProperties);

// Simple test route first
router.post('/test-upload', (req, res) => {
    console.log('=== TEST UPLOAD ROUTE HIT ===');
    res.json({ 
        message: 'Test upload route working',
        headers: req.headers,
        body: Object.keys(req.body || {}),
        files: req.files ? req.files.length : 0
    });
});

// Test route with multer
router.post('/test-multer', uploader.array('images', 8), (req, res) => {
    console.log('=== TEST MULTER ROUTE HIT ===');
    res.json({ 
        message: 'Test multer route working',
        files: req.files ? req.files.length : 0,
        fileDetails: req.files ? req.files.map(f => ({
            fieldname: f.fieldname,
            originalname: f.originalname,
            mimetype: f.mimetype
        })) : []
    });
});

// Test route without multer to see if basic route works
router.post('/test-basic', (req, res) => {
    console.log('=== TEST BASIC ROUTE HIT ===');
    res.json({ 
        message: 'Test basic route working',
        url: req.originalUrl,
        method: req.method,
        headers: req.headers
    });
});

// Test route with simple multer
router.post('/test-simple-multer', uploader.array('images', 1), (req, res) => {
    console.log('=== TEST SIMPLE MULTER ROUTE HIT ===');
    res.json({ 
        message: 'Test simple multer route working',
        files: req.files ? req.files.length : 0,
        fileDetails: req.files ? req.files.map(f => ({
            fieldname: f.fieldname,
            originalname: f.originalname,
            mimetype: f.mimetype
        })) : []
    });
});

// Specific POST routes first
router.post(
    '/addProperty',
    protect,
    (req, res, next) => {
        console.log('=== ROUTE MATCHED: /addProperty ===');
        console.log('Request URL:', req.originalUrl);
        console.log('Request method:', req.method);
        console.log('Request headers:', req.headers);
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Request body keys:', Object.keys(req.body || {}));
        console.log('User authenticated:', !!req.user);
        next();
    },
    uploader.any(), // Accept any field name for files
    (req, res, next) => {
        console.log('=== AFTER MULTER DEBUG ===');
        console.log('Files uploaded:', req.files ? req.files.length : 0);
        if (req.files && req.files.length > 0) {
            console.log('File details:');
            req.files.forEach((file, index) => {
                console.log(`  File ${index + 1}:`, {
                    fieldname: file.fieldname,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size
                });
            });
        }
        console.log('Request body after multer:', Object.keys(req.body || {}));
        next();
    },
    validation(PropertyValidator),
    (req, res, next) => {
        console.log('=== VALIDATION PASSED ===');
        console.log('Request body after validation:', req.body);
        console.log('Files after validation:', req.files ? req.files.length : 0);
        next();
    },
    propertyController.addProperty
);

// Specific PUT routes first
router.put(
    '/updateProperty/:id',
    protect,
    authorize('admin', 'agent'),
    uploader.array('newImages', 8), // Changed from 'newMedia' to 'newImages' to match frontend
    validation(PropertyValidator),
    propertyController.updateProperty
);

// Specific DELETE routes first
router.delete(
    '/deleteProperty/:id',
    protect,
    authorize('admin', 'agent'), 
    propertyController.deleteProperty
);

// Parameterized routes last (to avoid catching specific routes)
router.put('/:id/approve', propertyController.approveProperty);
router.delete('/:id/deny', propertyController.denyProperty);

// Wishlist/Favorites endpoints (parameterized routes last)
router.post('/:id/favorite', protect, propertyController.addToFavorites);
router.delete('/:id/favorite', protect, propertyController.removeFromFavorites);
router.get('/:id/favorite', protect, propertyController.checkFavoriteStatus);










export default router;