import { AppError } from '../middelWares/errorMiddleware.js';
import logger from './logger.js';

// Store for tracking request counts
const requestStore = new Map();

// Parse a positive integer env value; anything else (unset, "15 * 60 * 1000", "abc") falls back to the default
const parsePositiveInt = (value, fallback) =>
{
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

// Default rate limit configuration
const DEFAULT_WINDOW_MS = parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const DEFAULT_MAX_REQUESTS = parsePositiveInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100);

// Different rate limit configurations for different routes
export const rateLimitConfig = {
    // General API rate limit
    api: {
        windowMs: DEFAULT_WINDOW_MS,
        max: DEFAULT_MAX_REQUESTS,
        message: 'Too many requests from this IP, please try again later',
    },
    // Stricter limit for authentication routes
    auth: {
        windowMs: DEFAULT_WINDOW_MS,
        max: 10,
        message: 'Too many login attempts, please try again later',
    },
    // Stricter limit for password reset
    passwordReset: {
        windowMs: DEFAULT_WINDOW_MS,
        max: 5,
        message: 'Too many password reset attempts, please try again later',
    },
    // Stricter limit for file uploads
    fileUpload: {
        windowMs: DEFAULT_WINDOW_MS,
        max: 20,
        message: 'Too many file uploads, please try again later',
    },
    // Chatbot (each question may call Gemini)
    chat: {
        windowMs: DEFAULT_WINDOW_MS,
        max: 30,
        message: 'Too many chat requests, please try again later',
    }
};

// ems7 el  expired 
const cleanupInterval = setInterval(() =>
{
    const now = Date.now();
    for (const [key, data] of requestStore.entries())
    {
        if (now > data.resetTime)
        {
            requestStore.delete(key);
        }
    }
}, 60000); //  every minute
// Don't keep the process (or a serverless instance / import smoke test) alive just for cleanup
cleanupInterval.unref?.();



// Custom rate limiter middleware
export const rateLimiter = (type = 'api') =>
{
    const config = rateLimitConfig[type] || rateLimitConfig.api;

    return (req, res, next) =>
    {
        // Skip for whitelist don't include it in the rate limit
        const whitelistedIPs = process.env.WHITELISTED_IPS ?
            process.env.WHITELISTED_IPS.split(',') : [];
        if (whitelistedIPs.includes(req.ip))
        {
            return next();
        }

        // Generate key based on IP or user ID
        const key = req.user ? `${req.user._id}-${req.ip}-${type}` : `${req.ip}-${type}`;

        // Get current time
        const now = Date.now();

        // Get or create request data for this key
        if (!requestStore.has(key))
        {
            requestStore.set(key, {
                count: 0,
                resetTime: now + config.windowMs
            });
        }

        const requestData = requestStore.get(key);

        // Reset if window expired
        if (now > requestData.resetTime)
        {
            requestData.count = 0;
            requestData.resetTime = now + config.windowMs;
        }

        // Increment request count
        requestData.count += 1;

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', config.max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - requestData.count));
        res.setHeader('X-RateLimit-Reset', Math.ceil(requestData.resetTime / 1000));

        // Check if limit exceeded
        if (requestData.count > config.max)
        {
            // Log the rate limit exceeded event
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.path,
                method: req.method,
                limitType: type,
                windowMs: config.windowMs,
                max: config.max
            });

            // Send error response
            return res.status(429).json({
                success: false,
                message: config.message,
                retryAfter: Math.ceil((requestData.resetTime - now) / 1000), //to seconds
                limitType: type
            });
        }

        next();
    };
};

// Create specific rate limiters
export const apiLimiter = rateLimiter('api');
export const authLimiter = rateLimiter('auth');
export const passwordResetLimiter = rateLimiter('passwordReset');
export const fileUploadLimiter = rateLimiter('fileUpload');
export const chatLimiter = rateLimiter('chat');

// Export cleanup function for testing or graceful shutdown
export const cleanupRateLimiter = () =>
{
    clearInterval(cleanupInterval);
    requestStore.clear();
};