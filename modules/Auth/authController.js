import userModel from '../../Model/UserModel.js';
import { asyncHandler, AppError } from '../../middelWares/errorMiddleware.js';
import { hashFunction, compareFunction } from '../../utils/passwordHashing.js';
import sendEmail from '../../services/sendEmail.js';
import { tokenFunction, blacklistToken } from '../../utils/tokenFunction.js';
import { nanoid } from 'nanoid';









export const register = asyncHandler(async (req, res, next) => {
    const { userName, email, password, confirmPassword, phone, address } = req.body;

    if (!userName || !email || !password || !phone || !address) //check user inputs
        return res.status(400).json({ message: "All fields are required" });

    const checkUser = await userModel.findOne({ email });
    if (checkUser)
        return res.status(401).json({ message: "User exists , Or you are not confirmed yet" });

    const hashedPassword = hashFunction({ payload: password });

    const newUser = new userModel({
        userName,
        email,
        password: hashedPassword,
        phone,
        address
    });

    const token = tokenFunction({
        payload: { id: newUser._id, email: newUser.email },
        generate: true
    });




    const confirmationLink = `${process.env.CLIENT_URL}/confirm-email/${token}`;

    const Send = await sendEmail({
        to: newUser.email,
        subject: "Confirm your email",
        message: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #333; margin-bottom: 10px;">Welcome to Saknly!</h1>
                    <p style="color: #666; font-size: 16px;">Your real estate journey starts here</p>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
                    <h2 style="color: #333; margin-bottom: 15px;">Email Confirmation Required</h2>
                    <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
                        Hi ${newUser.userName},
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
        `
    });

    if (!Send) {
        return next(new AppError("Failed to send email", 500));
    }
    await newUser.save();//maybe u move it to the confirmation step
    res.status(201).json({
        success: true,
        message: "User registered successfully. Please verify your email.",
        data: {
            _id: newUser._id,
            userName: newUser.userName,
            email: newUser.email,
        },
    });
});

//=========================Confirmation Email=========================

export const confirmEmail = asyncHandler(async (req, res, next) => {
    const { token } = req.params;

    const decoded = tokenFunction({ payload: token, generate: false });

    if (!decoded?.id) {
        return next(new AppError("Invalid token", 400));
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
    const user = await userModel.findOne({ email, isConfirmed: true }).select('+password');
    if (!user) {
        return next(new AppError("User not found , Or you are not confirmed yet", 404));
    }
    const isPasswordCorrect = compareFunction({ payload: password, referenceData: user.password });

    if (!isPasswordCorrect) {
        return next(new AppError("Email or password are not correct", 400));
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
        httpOnly: true,
        secure: false, // لازم تبقى false في development
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
        path: "/",
    });

    await userModel.findOneAndUpdate(
        { email: email },
        { $set: { isLoggedIn: true, lastLoginAt: new Date(), status: 'active' } },
        { new: true }
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
    const { email } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) {
        return next(new AppError('No user found with this email address', 404));
    }

    const resetPasswordToken = nanoid(6);
    // Set token expiration time to 15 minutes from now
    const tokenExpiration = new Date(Date.now() + 15 * 60 * 1000);

    const emailed = await sendEmail({
        to: email,
        subject: 'Reset your Password',
        message: `
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
        `
    });

    if (!emailed) {
        return next(new AppError('Failed to send password reset email. Please try again later.', 503));
    }

    try {
        user.resetPasswordToken = resetPasswordToken;
        user.resetPasswordExpires = tokenExpiration;
        await user.save();
    } catch (saveError) {
        console.log("Failed to save reset password token to user, but email was sent:", saveError);
        // Continue execution as email was sent successfully
    }

    res.status(200).json({
        success: true,
        message: 'Password reset code sent successfully to your email.'
    });
});

//=========================resetPassword====================================
//virify that the code is correct and then update the password
export const resetPassword = asyncHandler(async (req, res, next) => {
    const { code, newPassword, confirmNewPassword } = req.body;

    if (!code || !newPassword || !confirmNewPassword) {
        return next(new AppError('code, new password, and confirm password are required', 400));
    }

    const user = await userModel.findOne({
        resetPasswordToken: code
    });

    if (!user) {
        return next(new AppError('Invalid email or reset code', 400));
    }

    // Check if token الكود مش التوكن الرئيسي has expired
    if (user.resetPasswordExpires && user.resetPasswordExpires < Date.now()) {
        return next(new AppError('Reset code has expired. Please request a new password reset.', 400));
    }

    // Hash the new password
    const hashedPassword = hashFunction({ payload: newPassword });

    // Store the original email for the notification
    const userEmail = user.email;

    // Update user password and clear the reset token
    await userModel.findByIdAndUpdate(
        user._id,
        {
            $set: {
                password: hashedPassword,
                resetPasswordToken: nanoid(),
                resetPasswordExpires: null
            }
        },
        { new: true }
    );

    // Send confirmation email that password was changed
    await sendEmail({
        to: userEmail,
        subject: 'Your Password Has Been Changed',
        message: `
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
                        <a href="${process.env.CLIENT_URL}/resetPassword" style="background-color: #0275d8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset My Password</a>
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
        `
    });

    res.status(200).json({
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.'
    });
});

//=========================refreshToken====================================
export const refreshToken = asyncHandler(async (req, res, next) => {
    const oldToken = req.headers.authorization?.split(process.env.BEARER_KEY)[1];

    if (!oldToken) {
        return next(new AppError('Token is required', 401));
    }

    try {
        // Verify old token and get payload
        const decoded = tokenFunction({
            payload: oldToken,
            generate: false
        });

        if (!decoded?.id) {
            return next(new AppError('Invalid token', 401));
        }

        // Find user by ID from token
        const user = await userModel.findById(decoded.id);
        if (!user || !user.isConfirmed || !user.isLoggedIn) {
            return next(new AppError('User not found or not authorized', 401));
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
    }
    catch (error) {
        return next(new AppError('Invalid or expired token', 401));
    }
});


//=========================logOut====================================
export const logOut = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    const token = req.headers.authorization?.split(process.env.BEARER_KEY)[1];

    if (!userId) {
        return next(new AppError('User ID is required', 400));
    }

    // Blacklist the current token
    const tokenBlacklisted = blacklistToken(token);
    if (!tokenBlacklisted) {
        console.log('Failed to blacklist token during logout');
    }

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

    res.clearCookie("token", {
        httpOnly: true,
        secure: false, // لازم تبقى برضه false
        sameSite: "strict",
        path: "/", // لازم يكون مطابق للمسار اللي حطيتي فيه الكوكي
    });


    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
});

