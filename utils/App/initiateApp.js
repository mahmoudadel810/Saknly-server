import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import connectDB, { ensureDbConnection, getDbState } from '../../DB/connection.js';
import { apiLimiter } from '../rateLimiter.js';

// Import middleware
import { errorHandler, notFound } from '../../middelWares/errorMiddleware.js';

const trimSlash = (url) => (url || '').trim().replace(/\/+$/, '');

// Allowed browser origins: defaults + CLIENT_URL + comma-separated CORS_ORIGINS
const buildAllowedOrigins = () =>
{
    const fromEnv = (process.env.CORS_ORIGINS || '')
        .split(',')
        .map(trimSlash)
        .filter(Boolean);

    return [
        'http://localhost:3000',
        'https://saknly-ruddy.vercel.app',
        trimSlash(process.env.CLIENT_URL),
        ...fromEnv
    ].filter(Boolean);
};

/**
 * Initialize express application with all middleware and configurations
 * @param {Object} routes - Object containing route modules to register
 * @returns {Object} Express application instance
 */
const initiateApp = (routes = {}) =>
{
    const app = express();
    const PORT = process.env.PORT || 5000;

    // Behind Vercel's proxy: use X-Forwarded-For for req.ip (rate limiting)
    app.set('trust proxy', 1);

    // Warm up the DB connection; failures are handled per request by ensureDbConnection
    connectDB().catch(() => { });

    // Security middleware
    app.use(helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // CORS configuration (before the rate limiter so 429 responses still carry CORS headers)
    const allowedOrigins = buildAllowedOrigins();
    app.use(cors({
        origin: function (origin, callback)
        {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            // Disallowed origins get no CORS headers (browser blocks), not a 500
            return callback(null, allowedOrigins.includes(trimSlash(origin)));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length']
    }));

    // Rate limiting
    app.use(apiLimiter);

    // parsing 
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Express 5 leaves req.body undefined when no parser matched
    app.use((req, res, next) =>
    {
        if (req.body === undefined) req.body = {};
        next();
    });

    // Compression middleware
    app.use(compression());

    // Logging middleware
    if (process.env.NODE_ENV === 'development')
    {
        app.use(morgan('dev'));
    } else
    {
        app.use(morgan('combined'));
    }


    //check if the server is running (reports DB state, never 503)
    app.get('/api/saknly/v1/health', (req, res) =>
    {
        res.status(200).json({
            success: true,
            message: 'Saknly API is running!',
            db: getDbState(),
            timestamp: new Date().toISOString()
        });
    });

    // Root route handler
    app.get('/', (req, res) =>
    {
        res.status(200).json({
            success: true,
            message: 'Welcome to Saknly API!',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            documentation: '/api/saknly/v1/health'
        });
    });

    // Every API route below needs the database
    app.use('/api/saknly/v1', ensureDbConnection);

    // Register all route modules
    if (routes)
    {
        Object.keys(routes).forEach(key =>
        {
            if (routes[key].path && routes[key].router)
            {
                app.use(routes[key].path, routes[key].router);
            }
        });
    }

    // Error handling 
    app.use(notFound);
    app.use(errorHandler);

    // Run the server
    const startServer = () =>
    {
        return app.listen(PORT, () =>
        {
            console.log(` Saknly server running in {${process.env.NODE_ENV}}  on port {${PORT}}`);
        });

    };

    return { app, startServer };
};

export default initiateApp;
