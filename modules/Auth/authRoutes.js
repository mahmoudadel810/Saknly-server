/** @format */
import { Router } from "express";
import * as authController from "./authController.js";
import { protect } from "../../middelWares/authMiddleware.js";
import { validation } from '../../middelWares/validation.js';
import { authLimiter, passwordResetLimiter } from '../../utils/rateLimiter.js';
import
{
    registerValidator,
    loginValidator,
    verifyResetValidator,
    emailOnlyValidator,
    refreshTokenValidator,
    logoutValidator
} from "./authValidation.js";
import googleAuthRouter from './googleAuthRouter.js';

const router = Router();

// Public routes
router.post("/register", authLimiter, validation(registerValidator), authController.register);
router.post("/resend-confirmation", passwordResetLimiter, validation(emailOnlyValidator), authController.resendConfirmation);
router.get('/confirm-email/:token', authController.confirmEmail);


router.post('/login', authLimiter, validation(loginValidator), authController.login);
router.get('/getMe', protect, authController.getMe);

// Token management routes
router.post('/refresh-token', validation(refreshTokenValidator), authController.refreshToken);

router.post('/logout', protect, validation(logoutValidator), authController.logOut);

// Password reset routes
router.post('/forgot-password', passwordResetLimiter, validation(emailOnlyValidator), authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, validation(verifyResetValidator), authController.resetPassword);

// Google OAuth routes
router.use('/google', googleAuthRouter);

export default router;
