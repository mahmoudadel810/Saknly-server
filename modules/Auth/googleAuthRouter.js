import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { findOrCreateGoogleUser } from './googleAccount.js';
import { verifyGoogleIdToken, googleAudiences } from '../../services/googleIdToken.js';
import { asyncHandler, AppError } from '../../middelWares/errorMiddleware.js';
import { validation } from '../../middelWares/validation.js';
import { googleMobileValidator } from './authValidation.js';
import { tokenFunction } from '../../utils/tokenFunction.js';
import logger from '../../utils/logger.js';
import { clientUrl } from './authController.js';

const router = express.Router();

const GOOGLE_CALLBACK_PATH = '/api/saknly/v1/auth/google/callback';

// CALLBACK_URL may be the full callback URL or just the API origin; BASE_URL is the fallback origin
const resolveCallbackUrl = () =>
{
    const configured = (process.env.CALLBACK_URL || '').trim();
    if (configured)
    {
        return configured.includes('/auth/google/callback')
            ? configured
            : configured.replace(/\/+$/, '') + GOOGLE_CALLBACK_PATH;
    }
    return (process.env.BASE_URL || '').trim().replace(/\/+$/, '') + GOOGLE_CALLBACK_PATH;
};

const isGoogleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// Stateless: the JWT handed to the client is the session (no express-session / passport.session)
router.use(passport.initialize());

if (isGoogleConfigured)
{
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: resolveCallbackUrl(),
    }, async (accessToken, refreshToken, profile, done) =>
    {
        try
        {
            const { user, failure } = await findOrCreateGoogleUser({
                email: profile.emails?.[0]?.value,
                googleId: profile.id,
                displayName: profile.displayName,
                givenName: profile.name?.givenName,
                familyName: profile.name?.familyName,
            });
            if (failure)
            {
                return done(null, false, { message: failure });
            }
            return done(null, user);
        } catch (err)
        {
            return done(err, null);
        }
    }));
}
else
{
    logger.warn('Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing); /auth/google routes are disabled');
}

const requireGoogleConfigured = (req, res, next) =>
{
    if (!isGoogleConfigured)
    {
        return res.status(503).json({ success: false, message: 'Google sign-in is not available' });
    }
    next();
};

// Mobile: the app signs in with Google on the phone and sends the ID token it got. Same account rules
// and the same token and user as POST /auth/login. Needs only GOOGLE_CLIENT_ID (no client secret).
router.post('/mobile', validation(googleMobileValidator), asyncHandler(async (req, res, next) =>
{
    if (googleAudiences().length === 0)
    {
        return next(new AppError('Google sign-in is not available', 503));
    }

    let identity;
    try
    {
        identity = await verifyGoogleIdToken(req.body.idToken);
    } catch (err)
    {
        // Only the text before the first colon: the library appends the token, or its decoded payload
        // (with the email), after it
        logger.warn(`Google ID token rejected: ${String(err?.message).split(':')[0]}`);
        return next(new AppError('Google sign-in failed. Please try again.', 401));
    }

    if (!identity.emailVerified)
    {
        return next(new AppError('Your Google email is not verified.', 401));
    }

    const { user, failure } = await findOrCreateGoogleUser(identity);
    if (failure === 'email_already_registered')
    {
        return next(new AppError('This email is registered with a password. Please log in with your email and password.', 409));
    }
    if (failure)
    {
        return next(new AppError('Google sign-in failed. Please try again.', 403));
    }

    const token = tokenFunction({
        payload: {
            id: user._id,
            email: user.email,
            userName: user.userName,
            role: user.role,
        }
    });
    if (!token)
    {
        return next(new AppError('Failed to generate token', 500));
    }

    res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
            _id: user._id,
            userName: user.userName,
            email: user.email,
            role: user.role,
        },
    });
}));

// Routes
router.get('/', requireGoogleConfigured, passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
    session: false
}));

router.get('/callback', requireGoogleConfigured, (req, res, next) =>
{
    passport.authenticate('google', { session: false }, (err, user, info) =>
    {
        if (err)
        {
            logger.error(`Google OAuth callback failed: ${err.message}`);
            return res.redirect(`${clientUrl()}/login?error=server_error`);
        }

        if (!user)
        {
            const reason = info?.message === 'email_already_registered' ? 'email_already_registered' : 'google_failed';
            return res.redirect(`${clientUrl()}/login?error=${reason}`);
        }

        const token = tokenFunction({
            payload: {
                id: user._id,
                email: user.email,
                userName: user.userName,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
            }
        });

        // The client page /login/success reads ?token= and stores it
        res.redirect(`${clientUrl()}/login/success?token=${encodeURIComponent(token)}`);
    })(req, res, next);
});

export default router;
