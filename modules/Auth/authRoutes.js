/** @format */
import { Router } from "express";
import * as authController from "./authController.js";
import { protect } from "../../middelWares/authMiddleware.js";
import { validation } from '../../middelWares/validation.js';
import
{
    registerValidator,
    loginValidator,
    verifyResetValidator,
    refreshTokenValidator,
    logoutValidator
} from "./authValidation.js";
import googleAuthRouter from './googleAuthRouter.js';

const router = Router();

// Public routes
router.post("/register", validation(registerValidator), authController.register);
router.get('/confirm-email/:token', authController.confirmEmail);


router.post('/login', validation(loginValidator), authController.login);
router.get('/getMe', protect, authController.getMe);

// Token management routes
router.post('/refresh-token', validation(refreshTokenValidator), authController.refreshToken);

router.post('/logout', protect, validation(logoutValidator), authController.logOut);

// Password reset routes
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', validation(verifyResetValidator), authController.resetPassword);

// Google OAuth routes
router.use('/google', googleAuthRouter);

export default router;