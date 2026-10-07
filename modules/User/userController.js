import User from "../../Model/UserModel.js";
import { asyncHandler, AppError } from "../../middelWares/errorMiddleware.js";
import Property from '../../Model/PropertyModel.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sameProperty = (item, propertyId) => !!item?.property && item.property.toString() === propertyId;

//=========================Get All Users====================================
export const getUsers = asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    
    // Build filter for search
    const filter = {};
    if (search && typeof search === 'string') {
        const safeSearch = escapeRegex(search.slice(0, 100));
        filter.$or = [
            { userName: { $regex: safeSearch, $options: 'i' } },
            { email: { $regex: safeSearch, $options: 'i' } },
            { firstName: { $regex: safeSearch, $options: 'i' } },
            { lastName: { $regex: safeSearch, $options: 'i' } }
        ];
    }

    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const itemsPerPage = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (currentPage - 1) * itemsPerPage;

    // Get total count
    const totalDocs = await User.countDocuments(filter);

    // Get users with pagination
    const users = await User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(itemsPerPage);

    const totalPages = Math.ceil(totalDocs / itemsPerPage);
    const hasMore = currentPage < totalPages;

    res.status(200).json({
        success: true,
        users,
        pagination: {
            currentPage,
            totalPages,
            totalDocs,
            itemsPerPage,
            hasMore
        }
    });
});

//=========================Get User By ID====================================
export const getUserById = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
        return next(new AppError("User not found", 404));
    }

    res.status(200).json({
        success: true,
        data: user
    });
});

//=========================Update User====================================
export const updateUser = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { userName, email, phone, address, role, status } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
        id,
        { userName, email, phone, address, role, status },
        { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
        return next(new AppError("User not found", 404));
    }

    res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser
    });
});

//=========================Delete User====================================
export const deleteUser = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
        return next(new AppError("User not found", 404));
    }

    res.status(200).json({
        success: true,
        message: 'User deleted successfully'
    });
});

//=========================Wishlist Functions====================================

// Get user wishlist
export const getUserWishlist = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;

    const user = await User.findById(userId)
        .populate({
            path: 'wishlist.property',
            populate: [
                { path: 'owner', select: 'userName email' },
                { path: 'agent', select: 'userName email' }
            ]
        });

    if (!user) {
        return next(new AppError("User not found", 404));
    }

    // Filter out any wishlist items where the property might have been deleted
    const validWishlistItems = user.wishlist.filter(item => item.property);

    res.status(200).json({
        success: true,
        count: validWishlistItems.length,
        data: validWishlistItems,
        message: 'Wishlist fetched successfully'
    });
});

// Add property to user wishlist
export const addToWishlist = asyncHandler(async (req, res, next) => {
    const { propertyId } = req.params;
    const userId = req.user._id;

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
        return next(new AppError("Property not found", 404));
    }

    const user = await User.findById(userId);
    if (!user) {
        return next(new AppError("User not found", 404));
    }

    // Check if property is already in wishlist
    const existingItem = user.wishlist.find(item => sameProperty(item, propertyId));

    if (existingItem) {
        return res.status(200).json({
            success: true,
            message: 'Property is already in wishlist',
            data: { propertyId }
        });
    }

    // Add to wishlist
    user.wishlist.push({
        property: propertyId,
        addedAt: new Date()
    });

    await user.save();

    res.status(200).json({
        success: true,
        message: 'Property added to wishlist successfully',
        data: { propertyId }
    });
});

// Remove property from user wishlist
export const removeFromWishlist = asyncHandler(async (req, res, next) => {
    const { propertyId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
        return next(new AppError("User not found", 404));
    }

    // Remove from wishlist (also drops entries whose property no longer exists)
    user.wishlist = user.wishlist.filter(item => item?.property && !sameProperty(item, propertyId));

    await user.save();

    res.status(200).json({
        success: true,
        message: 'Property removed from wishlist successfully',
        data: { propertyId }
    });
});

// Clear all wishlist items
export const clearWishlist = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
        return next(new AppError("User not found", 404));
    }

    // Clear wishlist
    user.wishlist = [];
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Wishlist cleared successfully',
        data: { count: 0 }
    });
});