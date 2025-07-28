import jwt from 'jsonwebtoken';
import User from '../Model/UserModel.js';
import { asyncHandler, AppError } from './errorMiddleware.js';
import logger from '../utils/logger.js';
import { isTokenBlacklisted } from '../utils/tokenFunction.js';
import propertyModel from '../Model/PropertyModel.js';


// Protect routes - verify token middleware
export const protect = asyncHandler(async (req, res, next) =>
{
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith(process.env.BEARER_KEY)
    )
    {
        token = req.headers.authorization.split(process.env.BEARER_KEY)[1];
    }

    if (!token)
    {
        return next(new AppError('Access denied. Not authorized to access this route', 401));
    }

    // Check if token is blacklisted (logged out)never share 
    if (isTokenBlacklisted(token))
    {
        return next(new AppError('Token is invalid or has been revoked. Please log in again', 401));
    }

    try
    {
        // Verify token and decode it
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let user;

        // Check if the token contains the id property
        if (decoded.id)
        {
            // Find user based on role
            user = await User.findById(decoded.id).select('-password');

            if (!user)
            {
                return next(new AppError('Authentication failed. User no longer exists', 401));
            }

            // Check if user is active
            if (user.status !== 'active')
            {
                return next(new AppError('Account is inactive. Please contact support', 401));
            }

            // Verify token role matches user role
            if (decoded.role !== user.role)
            {
                return next(new AppError('Token role mismatch. Please login again', 401));
            }
        }

        // Set user in request
        req.user = user;
        next();
    } catch (error)
    {
        console.error('Token verification failed:', error.message);
        return next(new AppError('Authentication failed. Invalid or expired token', 401));
    }
});


export const authorize = (...roles) =>
{
    return (req, res, next) =>
    {
        if (!req.user)
        {
            return next(new AppError('Authentication required to access this resource', 401));
        }

        if (!roles.includes(req.user.role))
        {
            return next(new AppError(`Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`, 403));
        }
        next();
    };
};

// Check if user owns the property or is admin
export const ownerOrAdmin = asyncHandler(async (req, res, next) =>
{
    if (!req.user)
    {
        return next(new AppError('Authentication required', 401));
    }

    const propertyId = req.params.propertyId;
    if (!propertyId)
    {
        return next(new AppError('Property ID not provided', 400));
    }

    // Allow access if user is admin
    if (req.user.role === 'admin')
    {
        return next();
    }

    // Check if user owns the property
    const property = await propertyModel.findById(propertyId);
    if (!property)
    {
        return next(new AppError('Property not found', 404));
    }

    if (property.owner.toString() === req.user._id.toString())
    {
        return next();
    }

    return next(new AppError('Not authorized to access this property', 403));
});


export const admin = asyncHandler(async (req, res, next) =>
{
    if (req.user.role !== 'admin')
    {
        return next(new AppError('Access denied. Only admins can access this resource', 403));
    }
    next();
});