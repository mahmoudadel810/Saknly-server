import userModel from '../../Model/UserModel.js';
import { asyncHandler, AppError } from '../../middelWares/errorMiddleware.js';
import { hashFunction, compareFunction } from '../../utils/passwordHashing.js';
import sendEmail from '../../services/sendEmail.js';
import { tokenFunction, blacklistToken } from '../../utils/tokenFunction.js';
import { getTokenFromHeader } from '../../middelWares/authMiddleware.js';
import logger from '../../utils/logger.js';
import { nanoid } from 'nanoid';

//=========================helpers====================================

// Front-end base URL (links in emails point to client pages)
export const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');

const isProduction = () => process.env.NODE_ENV === 'production';

// Cross-site cookie (API and client are on different domains in production)
const cookieOptions = () => ({
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'none' : 'lax',
    path: "/",
});

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const EMAIL_CONFIRMATION_PURPOSE = 'email-confirmation';

const confirmationEmailHtml = (userName, confirmationLink) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #333; margin-bottom: 10px;">Welcome to Saknly!</h1>
                    <p style="color: #666; font-size: 16px;">Your real estate journey starts here</p>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
                    <h2 style="color: #333; margin-bottom: 15px;">Email Confirmation Required</h2>
                    <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                        Hi ${userName},
                    </p>
                    <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                        Thank you for registering with Saknly! To complete your registration and start exploring properties, 
                        please confirm your email address by clicking the button below.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${confirmationLink}" 
                           style="background-color: #007bff; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; font-weight: bold; 
                                  display: inline-block;">
                            Confirm Email Address
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                        If the button doesn't work, you can copy and paste this link into your browser:
                    </p>
                    <p style="color: #007bff; font-size: 14px; word-break: break-all;">
                        ${confirmationLink}
                    </p>
                </div>
                
                <div style="text-align: center; color: #666; font-size: 14px;">
                    <p>This link will expire in 24 hours for security reasons.</p>
                    <p>If you didn't create an account with Saknly, please ignore this email.</p>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                    <p style="color: #999; font-size: 12px;">
                        © 2024 Saknly. All rights reserved.
                    </p>
                </div>
            </div>
        `;

const resetCodeEmailHtml = (resetPasswordToken) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #333; margin-bottom: 10px;">Password Reset Request</h1>
                    <p style="color: #666; font-size: 16px;">Secure your Saknly account</p>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
                    <h2 style="color: #333; margin-bottom: 15px;">Reset Your Password</h2>
                    <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                        Hi there,
                    </p>
                    <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                        We received a request to reset your password for your Saknly account. 
                        To complete the password reset process, please use the verification code below:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333;">
                            ${resetPasswordToken}
                        </div>
                    </div>
                    
                    <p style="color: #555; line-height: 1.6; margin-bottom: 10px;">
                        This code will expire in 15 minutes for security reasons.
                    </p>
                    
                    <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                        If you didn't request a password reset, please ignore this email or contact our support team if you have concerns.
                    </p>
                </div>
                
                <div style="text-align: center; color: #666; font-size: 14px;">
                    <p>For security reasons, never share this code with anyone.</p>
                    <p>The Saknly team will never ask for this code via phone or message.</p>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                    <p style="color: #999; font-size: 12px;">
                        © 2024 Saknly. All rights reserved.
                    </p>
                </div>
            </div>
        `;

const passwordChangedEmailHtml = () => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #333; margin-bottom: 10px;">Password Change Confirmation</h1>
                    <p style="color: #666; font-size: 16px;">Important Security Update</p>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
                    <h2 style="color: #333; margin-bottom: 15px;">Your Password Was Changed</h2>
                    <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                        Hi there,
                    </p>
                    <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                        This email confirms that your password for your Saknly account has been successfully changed.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <p style="color: #d9534f; font-weight: bold;">If you did not make this change, please secure your account immediately!</p>
                    </div>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="${clientUrl()}/resetPassword" style="background-color: #0275d8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset My Password</a>
                    </div>
                    
                    <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                        If you did make this change, you can safely ignore this email.
                    </p>
                </div>
                
                <div style="text-align: center; color: #666; font-size: 14px;">
                    <p>For security reasons, please ensure your account has a secure password.</p>
                    <p>The Saknly team will never ask for your password via phone or message.</p>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                    <p style="color: #999; font-size: 12px;">
                        © 2024 Saknly. All rights reserved.
                    </p>
                </div>
            </div>
        `;

// Never throws: returns true when the email was accepted by the mail server
const trySendEmail = async (options) =>
{
    try
    {
        return await sendEmail(options);
    }
    catch (error)
    {
        logger.error(`Email to recipient failed (${options.subject}): ${error.message}`);
        return false;
    }
};

// Confirmation link targets the client page /confirm-email/<token>, which calls GET /auth/confirm-email/:token
const sendConfirmationEmail = async (user) =>
{
    const token = tokenFunction({
        // purpose marks it as a non-session token: refresh-token refuses it
        payload: { id: user._id, email: user.email, purpose: EMAIL_CONFIRMATION_PURPOSE },
        expiresIn: '24h',
        generate: true
    });

    const confirmationLink = `${clientUrl()}/confirm-email/${token}`;

    return trySendEmail({
        to: user.email,
        subject: "Confirm your email",
        message: confirmationEmailHtml(user.userName, confirmationLink)
    });
};

//=========================Register====================================

export const register = asyncHandler(async (req, res, next) => {
    const { userName, firstName, lastName, email, password, phone, address } = req.body;

    if (!userName || !email || !password || !phone || !address) //check user inputs
        return res.status(400).json({ message: "All fields are required" });

    const normalizedEmail = String(email).toLowerCase().trim();

    // Any existing account, confirmed or not, keeps its password: replacing a pending account
    // would let anyone take over a victim's unconfirmed registration. Unconfirmed owners use
    // POST /auth/resend-confirmation. Same response either way, so confirmation state isn't revealed.
    const checkUser = await userModel.exists({ email: normalizedEmail });
    if (checkUser)
        return next(new AppError("This email is already registered", 409));

    const hashedPassword = hashFunction({ payload: password });

    const newUser = await userModel.create({
        userName,
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        email: normalizedEmail,
        password: hashedPassword,
        phone,
        address
    });

    // The account exists even if the email fails; the user can request a new link
    const emailSent = await sendConfirmationEmail(newUser);

    res.status(201).json({
        success: true,
        message: emailSent
            ? "User registered successfully. Please verify your email."
            : "User registered, but the confirmation email could not be sent. Please use 'resend confirmation' to get a new link.",
        emailSent,
        data: {
            _id: newUser._id,
            userName: newUser.userName,
            email: newUser.email,
        },
    });
});

//=========================Resend confirmation email=========================

export const resendConfirmation = asyncHandler(async (req, res, next) => {
    const normalizedEmail = String(req.body.email || '').toLowerCase().trim();

    const user = await userModel.findOne({ email: normalizedEmail, isConfirmed: false, provider: 'local' });
    if (user)
    {
        await sendConfirmationEmail(user);
    }

    // Generic response: don't reveal whether the email is registered
    res.status(200).json({
        success: true,
        message: "If this email belongs to an unconfirmed account, a new confirmation link has been sent."
    });
});

//=========================Confirmation Email=========================

export const confirmEmail = asyncHandler(async (req, res, next) => {
    const { token } = req.params;

    const decoded = tokenFunction({ payload: token, generate: false });

    if (!decoded?.id) {
        return next(new AppError("Invalid or expired confirmation link", 400));
    }


    const userConfirm = await userModel.findOneAndUpdate(
        { _id: decoded.id, isConfirmed: false },
        {
            $set: {
                isConfirmed: true,
                status: 'active'
            }
        },
        { new: true }
    );


    if (!userConfirm) {
        return res.status(400).json({
            success: false,
            message: "Email already confirmed or user not found"
        });
    }
    res.status(200).json({
        success: true,
        message: "Email confirmed successfully , you can now log in"
    });
});

//=========================Login====================================

export const login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return next(new AppError("Email and password are required", 400));
    }

    const user = await userModel.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
    if (!user) {
        return next(new AppError("Email or password are not correct", 400));
    }

    // Google-only accounts have no password
    if (!user.password) {
        return next(new AppError("This account uses Google sign-in. Please log in with Google.", 400));
    }

    const isPasswordCorrect = compareFunction({ payload: password, referenceData: user.password });

    if (!isPasswordCorrect) {
        return next(new AppError("Email or password are not correct", 400));
    }

    if (!user.isConfirmed) {
        return next(new AppError("Your email is not confirmed yet. Please confirm your email to log in.", 403));
    }

    if (user.status !== 'active') {
        return next(new AppError("Account is inactive. Please contact support", 403));
    }

    const token = tokenFunction({
        payload: {
            id: user._id,
            email: user.email,
            userName: user.userName,
            role: user.role
        }
    });
    if (!token) {
        return next(new AppError("Failed to generate token", 500));
    }

    res.cookie("token", token, {
        ...cookieOptions(),
        maxAge: 24 * 60 * 60 * 1000,
    });

    await userModel.updateOne(
        { _id: user._id },
        { $set: { isLoggedIn: true, lastLoginAt: new Date() } }
    );
    res.status(200).json({
        success: true,
        message: "Login successful",
        token: token,
        user: {
            _id: user._id,
            userName: user.userName,
            email: user.email,
            role: user.role
        }
    });
});



//========================getMe====================================
export const getMe = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;

    const user = await userModel.findById(userId);
    if (!user) {
        return next(new AppError("User not found", 404));
    }
    res.status(200).json({
        success: true,
        message: "User found",
        data: {
            user: user
        }
    });
});


//=========================forgotPassword====================================
//take the mail from user and send him a code to reset his password
export const forgotPassword = asyncHandler(async (req, res, next) => {
    const normalizedEmail = String(req.body.email || '').toLowerCase().trim();

    const genericResponse = {
        success: true,
        message: 'If an account exists for this email, a password reset code has been sent.'
    };

    const user = await userModel.findOne({ email: normalizedEmail });
    if (!user) {
        // Same response as success so the endpoint can't be used to discover accounts
        return res.status(200).json(genericResponse);
    }

    const resetPasswordToken = nanoid(6);

    // Save first, then email; the code expires in 15 minutes
    await userModel.updateOne(
        { _id: user._id },
        {
            $set: {
                resetPasswordToken,
                resetPasswordTokenExpiresIn: new Date(Date.now() + RESET_CODE_TTL_MS)
            }
        }
    );

    const emailed = await trySendEmail({
        to: user.email,
        subject: 'Reset your Password',
        message: resetCodeEmailHtml(resetPasswordToken)
    });

    if (!emailed) {
        await userModel.updateOne(
            { _id: user._id },
            { $unset: { resetPasswordToken: 1, resetPasswordTokenExpiresIn: 1 } }
        );
        return next(new AppError('We could not send the password reset email right now. Please try again later.', 503));
    }

    res.status(200).json(genericResponse);
});

//=========================resetPassword====================================
//verify that the email + code are correct and not expired, then update the password
export const resetPassword = asyncHandler(async (req, res, next) => {
    const { email, code, newPassword, confirmNewPassword } = req.body;

    if (!email || !code || !newPassword || !confirmNewPassword) {
        return next(new AppError('email, code, new password, and confirm password are required', 400));
    }

    const user = await userModel.findOne({
        email: String(email).toLowerCase().trim(),
        resetPasswordToken: String(code).trim()
    }).select('+resetPasswordToken +resetPasswordTokenExpiresIn');

    if (!user) {
        return next(new AppError('Invalid email or reset code', 400));
    }

    // Check if the reset code has expired (a missing expiry counts as expired)
    if (!user.resetPasswordTokenExpiresIn || user.resetPasswordTokenExpiresIn.getTime() < Date.now()) {
        await userModel.updateOne(
            { _id: user._id },
            { $unset: { resetPasswordToken: 1, resetPasswordTokenExpiresIn: 1 } }
        );
        return next(new AppError('Reset code has expired. Please request a new password reset.', 400));
    }

    // Hash the new password
    const hashedPassword = hashFunction({ payload: newPassword });

    // Update the password, clear the code (single use) and end existing sessions
    await userModel.updateOne(
        { _id: user._id, resetPasswordToken: user.resetPasswordToken },
        {
            $set: {
                password: hashedPassword,
                // revokes tokens issued before the reset (isLoggedIn is only changed by login/logout)
                lastLogoutAt: new Date()
            },
            $unset: { resetPasswordToken: 1, resetPasswordTokenExpiresIn: 1 }
        }
    );

    // Notification is best effort: a mail failure must not turn the reset into an error
    await trySendEmail({
        to: user.email,
        subject: 'Your Password Has Been Changed',
        message: passwordChangedEmailHtml()
    });

    res.status(200).json({
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.'
    });
});

//=========================refreshToken====================================
export const refreshToken = asyncHandler(async (req, res, next) => {
    const oldToken = getTokenFromHeader(req);

    if (!oldToken) {
        return next(new AppError('Token is required', 401));
    }

    // Verify old token and get payload
    const decoded = tokenFunction({
        payload: oldToken,
        generate: false
    });

    if (!decoded?.id) {
        return next(new AppError('Invalid token', 401));
    }

    // Only access tokens can be refreshed: purpose-bound tokens (email confirmation) and tokens
    // without the role claim are refused, as is a token whose role no longer matches the user
    if (decoded.purpose || !decoded.role) {
        return next(new AppError('Invalid token', 401));
    }

    // Find user by ID from token
    const user = await userModel.findById(decoded.id);
    if (!user || !user.isConfirmed || !user.isLoggedIn || user.status !== 'active') {
        return next(new AppError('User not found or not authorized', 401));
    }

    if (decoded.role !== user.role) {
        return next(new AppError('Token role mismatch. Please login again', 401));
    }

    // Tokens issued before the last logout can't be refreshed
    if (user.lastLogoutAt && decoded.iat < Math.floor(user.lastLogoutAt.getTime() / 1000)) {
        return next(new AppError('Session has ended. Please log in again', 401));
    }

    // Generate new token with fresh expiry
    const newToken = tokenFunction({
        payload: {
            id: user._id,
            email: user.email,
            userName: user.userName,
            role: user.role
        }
    });

    if (!newToken) {
        return next(new AppError('Failed to generate new token', 500));
    }

    res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        token: newToken,
        user: {
            _id: user._id,
            userName: user.userName,
            email: user.email,
            role: user.role
        }
    });
});


//=========================logOut====================================
export const logOut = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    const token = getTokenFromHeader(req);

    if (!userId) {
        return next(new AppError('User ID is required', 400));
    }

    // Fast path for this instance; lastLogoutAt below revokes the token everywhere
    blacklistToken(token);

    const user = await userModel.findByIdAndUpdate(
        userId,
        {
            $set: {
                isLoggedIn: false,
                lastLogoutAt: new Date()
            }
        },
        { new: true }
    );

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    res.clearCookie("token", cookieOptions());


    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
});
