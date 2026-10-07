import User from "../../Model/UserModel.js";
import { asyncHandler, AppError } from "../../middelWares/errorMiddleware.js";
import Property from '../../Model/PropertyModel.js';
import { PUBLIC_PROPERTY_FILTER } from '../Property/propertyController.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

// The wishlist and Property.favorites are two views of the same relation: every write below
// updates both with atomic operators (no read-modify-save), same as /properties/:id/favorite.

// Get user wishlist (public listings only)
export const getUserWishlist = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;

    const user = await User.findById(userId)
        .populate({
            path: 'wishlist.property',
            match: PUBLIC_PROPERTY_FILTER,
            populate: [
                { path: 'owner', select: 'userName email' },
                { path: 'agent', select: 'userName email' }
            ]
        });

    if (!user) {
        return next(new AppError("User not found", 404));
    }

    // Deleted listings and listings that are no longer public populate to null
    const validWishlistItems = user.wishlist.filter(item => item.property);

    res.status(200).json({
        success: true,
        count: validWishlistItems.length,
        data: validWishlistItems,
        message: 'Wishlist fetched successfully'
    });
});

// Add property to user wishlist (public listings only, idempotent)
export const addToWishlist = asyncHandler(async (req, res, next) => {
    const { propertyId } = req.params;
    const userId = req.user._id;

    const property = await Property.findOne({ _id: propertyId, ...PUBLIC_PROPERTY_FILTER }).select('_id');
    if (!property) {
        return next(new AppError("Property not found", 404));
    }

    await Property.updateOne({ _id: property._id }, { $addToSet: { favorites: userId } });
    const result = await User.updateOne(
        { _id: userId, 'wishlist.property': { $ne: property._id } },
        { $push: { wishlist: { property: property._id, addedAt: new Date() } } }
    );

    res.status(200).json({
        success: true,
        message: result.modifiedCount > 0 ? 'Property added to wishlist successfully' : 'Property is already in wishlist',
        data: { propertyId }
    });
});

// Remove property from user wishlist
export const removeFromWishlist = asyncHandler(async (req, res, next) => {
    const { propertyId } = req.params;
    const userId = req.user._id;

    await Property.updateOne({ _id: propertyId }, { $pull: { favorites: userId } });
    await User.updateOne({ _id: userId }, { $pull: { wishlist: { property: propertyId } } });

    res.status(200).json({
        success: true,
        message: 'Property removed from wishlist successfully',
        data: { propertyId }
    });
});

// Clear all wishlist items
export const clearWishlist = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;

    const user = await User.findById(userId).select('wishlist.property');
    if (!user) {
        return next(new AppError("User not found", 404));
    }

    // Remove exactly the entries read here, so an add racing the clear is not lost
    const propertyIds = user.wishlist.map(item => item.property).filter(Boolean);
    await Property.updateMany({ _id: { $in: propertyIds } }, { $pull: { favorites: userId } });
    await User.updateOne({ _id: userId }, { $pull: { wishlist: { $or: [{ property: { $in: propertyIds } }, { property: null }] } } });

    res.status(200).json({
        success: true,
        message: 'Wishlist cleared successfully',
        data: { count: 0 }
    });
});
