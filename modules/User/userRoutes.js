import { Router } from "express";
import * as userController from './userController.js';
import { updateUserValidator, deleteUserValidator } from './userValidation.js';
import { protect, admin } from '../../middelWares/authMiddleware.js';
import { validation } from '../../middelWares/validation.js';

const router = Router();

// Admin only routes (registration lives in POST /auth/register)
router.get('/get-all-users', protect, admin, userController.getUsers);
router.get('/get-user/:id', protect, admin, userController.getUserById);
router.put('/update-user/:id', protect, admin, validation(updateUserValidator), userController.updateUser);
router.delete('/delete-user/:id', protect, admin, validation(deleteUserValidator), userController.deleteUser);

// User wishlist routes
router.get('/me/wishlist', protect, userController.getUserWishlist);
router.post('/me/wishlist/:propertyId', protect, userController.addToWishlist);
router.delete('/me/wishlist/:propertyId', protect, userController.removeFromWishlist);
router.delete('/me/wishlist', protect, userController.clearWishlist);

export default router;