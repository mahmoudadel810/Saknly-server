import { Router } from "express";
import * as userController from './userController.js';
import { registerUserValidator, updateUserValidator, deleteUserValidator } from './userValidation.js';
import { protect, admin } from '../../middelWares/authMiddleware.js';
import { validation } from '../../middelWares/validation.js';

const router = Router();

// Public routes
router.post('/register', validation(registerUserValidator), userController.registerUser);

// Admin only routes
router.get('/get-all-users', userController.getUsers);
router.get('/get-user/:id', protect, admin, userController.getUserById);
router.put('/update-user/:id', protect, admin, validation(updateUserValidator), userController.updateUser);
router.delete('/delete-user/:id', protect, admin, validation(deleteUserValidator), userController.deleteUser);

// User wishlist routes
router.get('/me/wishlist', protect, userController.getUserWishlist);
router.post('/me/wishlist/:propertyId', protect, userController.addToWishlist);
router.delete('/me/wishlist/:propertyId', protect, userController.removeFromWishlist);
router.delete('/me/wishlist', protect, userController.clearWishlist);

export default router;