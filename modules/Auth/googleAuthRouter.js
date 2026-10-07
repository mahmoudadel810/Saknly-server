import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import userModel from '../../Model/UserModel.js';
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

const truncate = (value, max) => (value || '').trim().slice(0, max);

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
            const email = profile.emails?.[0]?.value?.toLowerCase();
            if (!email)
            {
                return done(null, false, { message: 'google_failed' });
            }

            let user = await userModel.findOne({ email });

            if (user)
            {
                if (user.provider === 'local')
                {
                    return done(null, false, { message: 'email_already_registered' });
                }
                if (user.status !== 'active')
                {
                    return done(null, false, { message: 'google_failed' });
                }
                user.isLoggedIn = true;
                user.lastLoginAt = new Date();
                await user.save();
                return done(null, user);
            }

            // Respect the model's max lengths (userName 30, firstName/lastName 20)
            const displayName = (profile.displayName || email.split('@')[0]).trim();
            const nameParts = displayName.split(/\s+/);
            const firstName = truncate(profile.name?.givenName || nameParts[0], 20);
            const lastName = truncate(profile.name?.familyName || nameParts.slice(1).join(' ') || firstName, 20);
            let userName = truncate(displayName, 30);
            if (userName.length < 3)
            {
                userName = truncate(email.split('@')[0].padEnd(3, '_'), 30);
            }

            const newUser = await userModel.create({
                firstName,
                lastName,
                userName,
                email,
                provider: 'google',
                googleId: profile.id,
                isConfirmed: true,
                isLoggedIn: true,
                lastLoginAt: new Date(),
                status: 'active',
            });

            return done(null, newUser);
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
