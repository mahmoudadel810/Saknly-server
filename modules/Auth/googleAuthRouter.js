import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import userModel from '../../Model/UserModel.js';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { tokenFunction } from '../../utils/tokenFunction.js';

// ضروري جدًا تحميل ملف env قبل استخدام أي متغير منه
dotenv.config({ path: path.resolve('./config/.env') });

const router = express.Router();

// Session middleware for Passport
router.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'development',
        maxAge: 24 * 60 * 60 * 1000 // 24 ساعة
    }
}));

// Initialize Passport
router.use(passport.initialize());
router.use(passport.session());

// Passport serialization/deserialization
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await userModel.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/api/saknly/v1/auth/google/callback`,
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        let user = await userModel.findOne({ email });

        if (user) {
            if (user.provider === 'local') {
                return done(null, false, { message: 'This email is already registered. Please log in with your password.' });
            }
            user.isLoggedIn = true;
            user.status = 'active';
            await user.save();
            return done(null, user);
        }

        const nameParts = profile.displayName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || firstName;

        const newUser = await userModel.create({
            firstName,
            lastName,
            userName: profile.displayName,
            
            email,
            provider: 'google',
            googleId: profile.id,
            isConfirmed: true, 
            isLoggedIn: true,
            status: 'active',
        });

        return done(null, newUser);
    } catch (err) {
        return done(err, null);
    }
}));

// Routes
router.get('/', passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
}));

router.get('/callback',
    passport.authenticate('google', {
        failureRedirect: `${process.env.CLIENT_URL}/login?error=google_failed`,
        failureFlash: true
    }),
    (req, res) => {
        const token = tokenFunction({
            payload: {
                id: req.user._id,
                email: req.user.email,
                userName: req.user.userName,
                role: req.user.role,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
            }
        });
        res.redirect(`${process.env.CLIENT_URL}/login/success?token=${token}`);
    }
);

router.get('/auth/logout', (req, res) => {
    req.logout();
    res.redirect(process.env.CLIENT_URL || "http://localhost:3000");
});

router.get('/auth/check', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            isAuthenticated: true,
            user: {
                id: req.user._id,
                userName: req.user.userName,
                email: req.user.email,
                role: req.user.role
            }
        });
    } else {
        res.json({ isAuthenticated: false });
    }
});

export default router;
