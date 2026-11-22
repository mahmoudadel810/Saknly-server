import { clientUrl } from './helpers.js';

// Each template returns { subject, message } for sendEmail

export const confirmationEmail = ({ userName, confirmationLink }) => ({
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
        `,
});

export const resetCodeEmail = ({ code }) => ({
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
                            ${code}
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
        `,
});

export const passwordChangedEmail = () => ({
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
        `,
});
