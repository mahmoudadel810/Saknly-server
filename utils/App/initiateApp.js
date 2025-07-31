import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from '../../DB/connection.js';
import { apiLimiter } from '../rateLimiter.js';

// Import middleware
import { errorHandler, notFound } from '../../middelWares/errorMiddleware.js';

/**
 * Initialize express application with all middleware and configurations
 * @param {Object} routes - Object containing route modules to register
 * @returns {Object} Express application instance
 */
const initiateApp = (routes = {}) =>
{
    dotenv.config({ path: path.resolve('./config/.env') });

    const app = express();
    const PORT = process.env.PORT || 5000;


    connectDB();

    // Security middleware ,search for what u can prevent in docs for more security.

    app.use(helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // Rate limiting
    app.use(apiLimiter);

    // CORS configuration
    app.use(cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);
            
            const allowedOrigins = [
                'http://localhost:3000',
                'https://saknly-ruddy.vercel.app',
                process.env.CLIENT_URL
            ].filter(Boolean); // Remove any undefined values
            
            if (allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));


    // parsing 
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression middleware
    app.use(compression()); // compress the response to reduce the size of the response for faster loading  ليفل من ١-٩ 

    // Logging middleware
    if (process.env.NODE_ENV === 'development')
    {
        app.use(morgan('dev'));
    } else
    {
        app.use(morgan('combined'));
    }

    
    //check if the server is running
    app.get('/api/saknly/v1/health', (req, res) =>
    {
        res.status(200).json({
            success: true,
            message: 'Saknly API is running!',
            timestamp: new Date().toISOString(),
            availableRoutes: routes
        });
    });

    // Test route to verify the app is working
    app.get('/api/saknly/v1/test', (req, res) => {
        console.log('=== APP TEST ROUTE HIT ===');
        res.json({ 
            message: 'App is working',
            routes: Object.keys(routes || {}),
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

    // Register all route modules
    if (routes)
    {
        Object.keys(routes).forEach(key =>
        {
            if (routes[key].path && routes[key].router)
            {
                console.log(`Registering route: ${routes[key].path}`);
                console.log(`Route key: ${key}`);
                console.log(`Route path: ${routes[key].path}`);
                console.log(`Route router type: ${typeof routes[key].router}`);
                app.use(routes[key].path, routes[key].router);
                console.log(`Route registered successfully: ${routes[key].path}`);
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
