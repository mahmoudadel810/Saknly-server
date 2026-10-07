import logger from '../utils/logger.js';
import cloudinary from '../services/cloudinary.js';

// A request that failed after multer stored files in Cloudinary must not leave orphans
const discardUploadedFiles = (req) =>
{
    const files = [];
    if (req.file) files.push(req.file);
    if (req.files) files.push(...(Array.isArray(req.files) ? req.files : Object.values(req.files).flat()));

    files.forEach(file =>
    {
        if (file?.public_id)
        {
            Promise.resolve(cloudinary.uploader.destroy(file.public_id)).catch(() => { });
        }
    });
};

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
    logger.warn(`Not Found - ${req.originalUrl}`, { method: req.method });
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
        const field = Object.keys(err.keyValue || {})[0] || 'Value';
        message = `${field} already exists`;
        statusCode = 400;
    }

    // Mongoose validation error
    if (err.name === 'ValidationError')
    {
        message = Object.values(err.errors).map(val => val.message).join(', ');
        statusCode = 400;
    }

    // Joi validation error (from our custom validation middleware)
    if (err.message && err.message.includes('Validation failed:'))
    {
        statusCode = 400;
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

    // Multer errors (unexpected field, too many files, ...)
    if (err.name === 'MulterError')
    {
        message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : `Upload error: ${err.message}`;
        statusCode = 400;
    }

    // Email errors
    if (err.message && err.message.includes('ENOTFOUND'))
    {
        message = 'Email service unavailable';
        statusCode = 503;
    }

    discardUploadedFiles(req);

    // Log server errors with stack; client errors as a one-line warning
    if (statusCode >= 500)
    {
        logger.error(`${statusCode} - ${message}`, { stack: err.stack });
    }
    else
    {
        logger.warn(`${statusCode} - ${message}`);
    }

    // Never leak internals of unexpected errors in production
    if (statusCode >= 500 && process.env.NODE_ENV === 'production' && !err.isOperational)
    {
        message = 'Internal server error';
    }

    res.status(statusCode).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : null,
        ...(process.env.NODE_ENV === 'development' && { error: err }),
    });
};
