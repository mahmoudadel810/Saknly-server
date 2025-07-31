import logger from '../utils/logger.js';

export class AppError extends Error
{
    constructor(message, statusCode)
    {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

export const asyncHandler = (fn) => (req, res, next) =>
{
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Handle 404 errors
export const notFound = (req, res, next) =>
{
    const error = new AppError(`Not Found - ${req.originalUrl}`, 404);
    // Log not-found errors as warnings
    logger.warn(`Not Found - ${req.originalUrl}`, { method: req.method, ip: req.ip, user: req.user ? req.user._id : 'anonymous' });
    console.log(`WARNING: Not Found - ${req.originalUrl}`);
    next(error);
};

// Global error handler
export const errorHandler = (err, req, res, next) =>
{
    let statusCode = err.statusCode || 500;
    let message = err.message;

    // Mongoose bad ObjectId
    if (err.name === 'CastError')
    {
        message = 'Resource not found';
        statusCode = 404;
    }

    // Mongoose duplicate key
    if (err.code === 11000)
    {
        const field = Object.keys(err.keyValue)[0];
        message = `${field} already exists`;
        statusCode = 400;
    }

    // Mongoose validation error
    if (err.name === 'ValidationError')
    {
        message = Object.values(err.errors).map(val => val.message).join(', ');
        statusCode = 400;
        logger.error(`${statusCode} - ${message}`, { stack: err.stack });
        console.log(`ERROR [${statusCode}]: ${message}`);
    }

    // Joi validation error (from our custom validation middleware)
    if (err.message && err.message.includes('Validation failed:'))
    {
        statusCode = 400;
        console.log('=== VALIDATION ERROR ===');
        console.log('Error message:', err.message);
        console.log('Request URL:', req.originalUrl);
        console.log('Request method:', req.method);
        console.log('Request body keys:', Object.keys(req.body || {}));
        console.log('Files:', req.files ? req.files.length : 0);
        console.log('Content-Type:', req.headers['content-type']);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError')
    {
        message = 'Invalid token';
        statusCode = 401;
    }

    if (err.name === 'TokenExpiredError')
    {
        message = 'Token expired';
        statusCode = 401;
    }

    // File upload errors
    if (err.code === 'LIMIT_FILE_SIZE')
    {
        message = 'File too large';
        statusCode = 400;
    }

    // Multer "Unexpected field" error
    if (err.message === 'Unexpected field')
    {
        message = `Invalid file field name. Please check the form field names. Error details: ${err.message}`;
        statusCode = 400;
        console.log('=== MULTER UNEXPECTED FIELD ERROR ===');
        console.log('Error message:', err.message);
        console.log('Error stack:', err.stack);
        console.log('Request URL:', req.originalUrl);
        console.log('Request method:', req.method);
        console.log('Request headers:', req.headers);
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Request body keys:', Object.keys(req.body || {}));
        console.log('Files:', req.files);
        console.log('File field names:', req.files ? req.files.map(f => f.fieldname) : 'No files');
        console.log('Expected field name: images');
        console.log('All field names in request:', Object.keys(req.body || {}));
    }

    // Email errors
    if (err.message && err.message.includes('ENOTFOUND'))
    {
        message = 'Email service unavailable';
        statusCode = 503;
    }

    // Log error using Winston
    logger.error(`${statusCode} - ${message}`, { stack: err.stack });

    // Console log with visual indicator for better visibility
    console.log(`ERROR [${statusCode}]: ${message}`);

    // In development, also log the stack trace
    if (process.env.NODE_ENV === 'development')
    {
        console.log('Stack trace:', err.stack);
    }

    res.status(statusCode).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
        ...(process.env.NODE_ENV === 'development' && { error: err }),
    });
};
