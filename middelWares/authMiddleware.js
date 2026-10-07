import jwt from 'jsonwebtoken';
import User from '../Model/UserModel.js';
import { asyncHandler, AppError } from './errorMiddleware.js';
import { isTokenBlacklisted } from '../utils/tokenFunction.js';
import propertyModel from '../Model/PropertyModel.js';


// Extract the raw JWT from "Authorization: <BEARER_KEY><jwt>" (e.g. "Saknly__eyJ...")
export const getTokenFromHeader = (req) =>
{
    const prefix = process.env.BEARER_KEY || 'Saknly__';
    const header = req.headers.authorization;

    if (header && header.startsWith(prefix))
    {
        return header.slice(prefix.length).trim() || null;
    }
    return null;
};

// Verify a token and load the active user it belongs to. Throws AppError on failure.
const resolveUserFromToken = async (token) =>
{
    // Check if token is blacklisted (logged out on this instance)
    if (isTokenBlacklisted(token))
    {
        throw new AppError('Token is invalid or has been revoked. Please log in again', 401);
    }

    let decoded;
    try
    {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    }
    catch (error)
    {
        throw new AppError('Authentication failed. Invalid or expired token', 401);
    }

    if (!decoded?.id)
    {
        throw new AppError('Authentication failed. Invalid token', 401);
    }

    const user = await User.findById(decoded.id).select('-password');

    if (!user)
    {
        throw new AppError('Authentication failed. User no longer exists', 401);
    }

    // Check if user is active
    if (user.status !== 'active')
    {
        throw new AppError('Account is inactive. Please contact support', 401);
    }

    // Verify token role matches user role
    if (decoded.role !== user.role)
    {
        throw new AppError('Token role mismatch. Please login again', 401);
    }

    // Logout is stored in the DB so it applies on every serverless instance:
    // tokens issued before the last logout are rejected (iat is in whole seconds)
    if (user.lastLogoutAt && decoded.iat < Math.floor(user.lastLogoutAt.getTime() / 1000))
    {
        throw new AppError('Session has ended. Please log in again', 401);
    }

    return user;
};

// Protect routes - verify token middleware
export const protect = asyncHandler(async (req, res, next) =>
{
    const token = getTokenFromHeader(req);

    if (!token)
    {
        return next(new AppError('Access denied. Not authorized to access this route', 401));
    }

    try
    {
        req.user = await resolveUserFromToken(token);
        next();
    }
    catch (error)
    {
        return next(error);
    }
});

// Optional auth: sets req.user when a valid token is sent, otherwise continues anonymously
export const optionalAuth = asyncHandler(async (req, res, next) =>
{
    const token = getTokenFromHeader(req);

    if (token)
    {
        try
        {
            req.user = await resolveUserFromToken(token);
        }
        catch (error)
        {
            req.user = undefined;
        }
    }
    next();
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
    if (!req.user)
    {
        return next(new AppError('Authentication required to access this resource', 401));
    }

    if (req.user.role !== 'admin')
    {
        return next(new AppError('Access denied. Only admins can access this resource', 403));
    }
    next();
});