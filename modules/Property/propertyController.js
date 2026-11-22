// server/modules/Property/PropertyController.js

import propertyModel from '../../Model/PropertyModel.js';
import { AppError, asyncHandler } from '../../middelWares/errorMiddleware.js';
import { removeMedia } from '../../services/mediaCleanup.js';
import ApiFeatures from '../../utils/apiFeatures.js';
import { dispatchEmail } from '../../services/notify.js';
import { publishEvent } from '../../services/queue/publisher.js';
import userModel from '../../Model/UserModel.js';
import Agency from '../../Model/AgencyModel.js';
import Comment from '../../Model/CommentModel.js';
import PropertyInquiry from '../../Model/PropertyInquiryModel.js';
import logger from '../../utils/logger.js';

// Translation function for status values
const translateText = (text) => {
    const translations = {
        // Status translations
        'available': 'متاح',
        'rented': 'مؤجر',
        'sold': 'مباع',
        'pending': 'قيد المراجعة',
        'inactive': 'غير نشط',
        // Property types are already in Arabic in the model
    };
    
    return translations[text] || text;
};

// Only approved + active listings are public
export const PUBLIC_PROPERTY_FILTER = Object.freeze({ isApproved: true, isActive: true });

const isAdmin = (user) => user?.role === 'admin';

const isOwner = (property, user) => !!user && !!property?.owner &&
    (property.owner._id || property.owner).equals(user._id);

const isPublic = (property) => property.isApproved === true && property.isActive === true;

// Fields a property owner may set. Everything else (owner, agent, views, favorites,
// approvedBy/At, rejectionReason, isApproved, isActive, slug, inquiries, ...) is ignored.
const OWNER_EDITABLE_FIELDS = [
    'title', 'description', 'type', 'price', 'area', 'bedrooms', 'bathrooms', 'floor', 'totalFloors',
    'location', 'amenities', 'contactInfo', 'isNegotiable', 'isStudentFriendly', 'studentHousingDetails',
    // sale
    'deliveryDate', 'deliveryTerms', 'paymentMethod', 'downPayment', 'installmentPeriodInYears',
    'minInstallmentAmount', 'ownershipType', 'propertyStatus',
    // rent / student
    'availableFrom', 'leaseDuration', 'deposit', 'utilities', 'rules',
];
const ADMIN_EXTRA_FIELDS = ['agency', 'status'];

const pickPropertyFields = (body = {}, user) =>
{
    const allowed = isAdmin(user) ? [...OWNER_EDITABLE_FIELDS, ...ADMIN_EXTRA_FIELDS] : OWNER_EDITABLE_FIELDS;
    const picked = {};
    for (const key of allowed)
    {
        if (body[key] !== undefined) picked[key] = body[key];
    }
    return picked;
};

const isPlainObject = (value) => value !== null && typeof value === 'object' &&
    !Array.isArray(value) && !(value instanceof Date) && Object.getPrototypeOf(value) === Object.prototype;

// {location: {city: 'x'}} -> {'location.city': 'x'} so a partial update doesn't wipe sibling fields
const flattenForUpdate = (obj, prefix = '', out = {}) =>
{
    for (const [key, value] of Object.entries(obj))
    {
        if (key.startsWith('$')) continue;
        const path = prefix ? `${prefix}.${key}` : key;
        if (isPlainObject(value)) flattenForUpdate(value, path, out);
        else out[path] = value;
    }
    return out;
};

const parseMaybeJson = (value) =>
{
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
};

// Remove every reference to a property (agency list, wishlists), the comments and inquiries
// that belong to it, and its Cloudinary images. Used by owner delete and admin deny.
// Best effort: failures are logged, never thrown.
const cleanupPropertyReferences = async (property) =>
{
    const id = property._id;
    const results = await Promise.allSettled([
        Agency.updateMany({ properties: id }, { $pull: { properties: id } }),
        userModel.updateMany({ 'wishlist.property': id }, { $pull: { wishlist: { property: id } } }),
        Comment.deleteMany({ property: id }),
        PropertyInquiry.deleteMany({ property: id }),
        removeMedia(property.images || [], `property ${id} removed`),
    ]);
    results
        .filter(r => r.status === 'rejected')
        .forEach(r => logger.warn(`Property ${id} cleanup step failed: ${r.reason?.message || r.reason}`));
};

const paginationMeta = (query, totalDocs) =>
{
    const currentPage = ApiFeatures.getPage(query);
    const itemsPerPage = ApiFeatures.getLimit(query);
    const totalPages = Math.ceil(totalDocs / itemsPerPage);
    return {
        currentPage,
        totalPages,
        totalDocs,
        itemsPerPage,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
    };
};


//=====================================get all properties (public: approved + active only)=====================================
export const getAllProperties = asyncHandler(async (req, res, next) =>
{
    const filter = ApiFeatures.buildFilter(req.query, PUBLIC_PROPERTY_FILTER);
    const totalDocs = await propertyModel.countDocuments(filter);

    const dataApiFeatures = new ApiFeatures(propertyModel.find(), req.query, PUBLIC_PROPERTY_FILTER)
        .filter()
        .sort()
        .limitFields()
        .paginate(); 

    const properties = await dataApiFeatures.mongooseQuery
        .populate('owner', 'userName')
        .populate('agent', 'userName');

    res.status(200).json({
        success: true,
        data: properties,
        message: totalDocs === 0 ? 'No properties found matching your criteria.' : 'Properties fetched successfully',
        pagination: paginationMeta(req.query, totalDocs)
    });
});


//=====================================get property details=====================================
// Public for approved+active listings; an unapproved listing is visible only to its owner or an admin
export const getPropertyDetails = asyncHandler(async (req, res, next) =>
{
    const { _id } = req.params;
    const property = await propertyModel.findById(_id)
        .populate('owner', 'userName email phone')
        .populate('agent', 'userName email phone')
        .populate('approvedBy', 'userName');

    if (!property || (!isPublic(property) && !isOwner(property, req.user) && !isAdmin(req.user)))
    {
        return next(new AppError('Property not found', 404));
    }

    if (isPublic(property))
    {
        await propertyModel.updateOne({ _id: property._id }, { $inc: { views: 1 } });
        property.views += 1;
    }

    res.status(200).json({
        success: true,
        data: property,
        message: 'Property details fetched successfully',
    });
});

//=====================================search properties=====================================

export const searchProperties = asyncHandler(async (req, res, next) => {
    const features = new ApiFeatures(propertyModel.find(), req.query, PUBLIC_PROPERTY_FILTER)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const properties = await features.mongooseQuery
        .populate('owner', 'userName')
        .populate('agent', 'userName');

    res.status(200).json({
        success: true,
        count: properties.length,
        data: properties,
        message: properties.length === 0
            ? 'No properties found'
            : 'Properties fetched successfully based on search criteria',
    });
});


//=====================================add property=====================================

export const addProperty = asyncHandler(async (req, res, next) =>
{
    const { category } = req.body;
    const uploadedFiles = req.files;

    // Validate category
    if (!category || !['sale', 'rent', 'student'].includes(category)) {
        return next(new AppError('Invalid property category provided. Must be: sale, rent, or student.', 400));
    }

    // Ensure the user is authenticated
    if (!req.user || !req.user._id)
    {
        return next(new AppError('Authentication error: User ID is missing.', 401));
    }
 
    // Map uploaded files to the format required by the Property schema
    const mediaLinks = (uploadedFiles || []).map(file => ({
        publicId: file.public_id,
        url: file.path,           // secure_url from Cloudinary
        isMain: false
    }));

    // Designate the first uploaded file as the main image/media
    if (mediaLinks.length > 0)
    {
        mediaLinks[0].isMain = true;
    }

    // Only whitelisted fields from the body; server-controlled fields are set below
    const newPropertyData = {
        ...pickPropertyFields(req.body, req.user),
        category,
        owner: req.user._id,
        images: mediaLinks,
    };

    if (isAdmin(req.user)) {
        newPropertyData.status = newPropertyData.status || 'available';
        newPropertyData.isApproved = true;
        newPropertyData.isActive = true;
        newPropertyData.approvedBy = req.user._id;
        newPropertyData.approvedAt = new Date();
    } else {
        // Regular users' listings wait for admin approval
        newPropertyData.status = 'pending';
        newPropertyData.isApproved = false;
        newPropertyData.isActive = false;
    }
    
    // The base model picks the right discriminator from `category`
    const newProperty = new propertyModel(newPropertyData);
    await newProperty.save();

    // If property has an agency, push its ID to the agency's properties array
    if (newProperty.agency) {
      await Agency.findByIdAndUpdate(newProperty.agency, { $addToSet: { properties: newProperty._id } });
    }

    res.status(201).json({
        success: true,
        message: 'Property created successfully.',
        data: newProperty,
    });
});

//=====================================update property=====================================
// Owner or admin. A non-admin edit sends the listing back to the approval queue (same as create).
export const updateProperty = asyncHandler(async (req, res, next) =>
{
    const { id } = req.params;
    const newFiles = req.files;

    const property = await propertyModel.findById(id);
    if (!property) return next(new AppError('Property not found', 404));

    if (!isOwner(property, req.user) && !isAdmin(req.user))
        return next(new AppError('User is not authorized to update this property', 403));

    const previousAgency = property.agency ? property.agency.toString() : null;
    const previousImages = property.images.map(img => ({ publicId: img.publicId, url: img.url }));

    // ---- images
    const imagesToDeleteRaw = parseMaybeJson(req.body.imagesToDelete);
    const imagesToDelete = (Array.isArray(imagesToDeleteRaw) ? imagesToDeleteRaw : (imagesToDeleteRaw ? [imagesToDeleteRaw] : []))
        .map(String)
        // only images that belong to this property may be deleted
        .filter(publicId => property.images.some(img => img.publicId === publicId));

    let finalImagesList = property.images
        .filter(img => !imagesToDelete.includes(img.publicId))
        .map(img => ({ publicId: img.publicId, url: img.url, alt: img.alt, isMain: img.isMain }));

    const newlyUploadedImages = (newFiles || []).map(file => ({
        publicId: file.public_id,
        url: file.path,
        isMain: false,
    }));

    const frontendManagedImages = parseMaybeJson(req.body.images);
    if (Array.isArray(frontendManagedImages))
    {
        // Client sends the ordered list of existing images it wants to keep (+ isMain flags)
        const kept = [];
        frontendManagedImages.forEach(img =>
        {
            const dbImg = finalImagesList.find(db => db.publicId === img?.publicId);
            if (dbImg && !kept.some(k => k.publicId === dbImg.publicId))
            {
                kept.push({ ...dbImg, isMain: img.isMain === true || img.isMain === 'true' });
            }
        });
        finalImagesList = [...newlyUploadedImages, ...kept];
    }
    else
    {
        finalImagesList = [...finalImagesList, ...newlyUploadedImages];
    }

    if (finalImagesList.length > 0 && !finalImagesList.some(img => img.isMain))
    {
        finalImagesList[0].isMain = true;
    }

    // ---- fields (category can't change: it selects the schema)
    const updates = flattenForUpdate(pickPropertyFields(req.body, req.user));
    property.set(updates);
    property.images = finalImagesList;

    if (!isAdmin(req.user))
    {
        property.status = 'pending';
        property.isApproved = false;
        property.isActive = false;
        property.approvedBy = undefined;
        property.approvedAt = undefined;
    }

    await property.save();

    // Keep agency.properties[] in sync when an admin moves the listing
    const currentAgency = property.agency ? property.agency.toString() : null;
    if (previousAgency !== currentAgency)
    {
        if (previousAgency) await Agency.updateOne({ _id: previousAgency }, { $pull: { properties: property._id } });
        if (currentAgency) await Agency.updateOne({ _id: currentAgency }, { $addToSet: { properties: property._id } });
    }

    // Remove dropped images from Cloudinary only after the DB update succeeded
    const keptIds = new Set(property.images.map(img => img.publicId));
    const removed = previousImages.filter(img => img.publicId && !keptIds.has(img.publicId));
    if (removed.length > 0)
    {
        try
        {
            await removeMedia(removed, `property ${property._id} images replaced`);
        }
        catch (error)
        {
            logger.warn(`Failed to delete images of property ${property._id}: ${error.message}`);
        }
    }

    res.status(200).json({
        success: true,
        data: property,
        message: 'Property updated successfully',
    });
});

//=====================================delete property================================================
// Owner or admin
export const deleteProperty = asyncHandler(async (req, res, next) =>
{
    const { id } = req.params;
    const property = await propertyModel.findById(id);

    if (!property) return next(new AppError('Property not found', 404));

    if (!isOwner(property, req.user) && !isAdmin(req.user))
        return next(new AppError('User is not authorized to delete this property', 403));

    await property.deleteOne();

    // Remove from agency properties[] and users' wishlists; delete Cloudinary images (best effort)
    await cleanupPropertyReferences(property);

    // Recorded by the audit consumer; a no-op when the queue is off
    await publishEvent('property.deleted', {
        propertyId: String(property._id),
        title: property.title,
        deletedBy: String(req.user._id),
    });

    res.status(200).json({
        success: true,
        message: 'Property deleted successfully',
    });
});

//=====================================get most viewed properties=====================================

// get most viewed properties (for home page) - public listings only
export const getMostViewedProperties = asyncHandler(async (req, res, next) =>
{
    const properties = await propertyModel.find(PUBLIC_PROPERTY_FILTER)
        .sort({ views: -1 })
        .limit(10)
        .populate('owner', 'userName')
        .populate('agent', 'userName');

    if (properties.length === 0)
    {
        return res.status(200).json({
            success: true,
            data: [],
            message: 'No active and approved properties found',
        });
    }

    const processedProperties = properties.map(property => {
        const propertyObject = property.toObject();
        // Translate status to Arabic
        if (propertyObject.status) {
            propertyObject.status = translateText(propertyObject.status);
        }
        propertyObject.sliderImages = (propertyObject.images || []).map(img => img.url);
        return propertyObject;
    });

    res.status(200).json({
        success: true,
        count: processedProperties.length,
        data: processedProperties,
        message: 'Most viewed active and approved properties fetched successfully',
    });
});

//=====================================get all pending properties (admin)=====================================
export const getPendingProperties = asyncHandler(async (req, res, next) => {
    const { category } = req.query; // category: sale, rent, student
    const filter = { status: 'pending' };
    if (typeof category === 'string' && ['sale', 'rent', 'student'].includes(category)) {
        filter.category = category;
    }
    const properties = await propertyModel.find(filter)
        .sort({ createdAt: -1 })
        .populate('owner', 'userName email')
        .populate('agent', 'userName email');
    res.status(200).json({
        success: true,
        count: properties.length,
        data: properties,
        message: 'Pending properties fetched successfully',
    });
});

//=====================================approve property (admin)=====================================
export const approveProperty = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { status, isActive, isApproved } = req.body;

    const property = await propertyModel.findById(id).populate('owner', 'email userName');
    if (!property) return next(new AppError('Property not found', 404));

    const allowedStatuses = ['available', 'rented', 'sold', 'pending', 'inactive'];
    property.status = allowedStatuses.includes(status) ? status : 'available';
    property.isActive = typeof isActive === 'boolean' ? isActive : true;
    property.isApproved = typeof isApproved === 'boolean' ? isApproved : true;
    property.approvedBy = req.user._id;
    property.approvedAt = new Date();
    property.rejectionReason = undefined;
    await property.save();

    // Notify the owner (best effort; no email when the listing has no contact email)
    await dispatchEmail('property.approved', {
        propertyId: String(property._id),
        title: property.title,
        ownerName: property.contactInfo?.name,
        contactEmail: property.contactInfo?.email,
    });

    res.status(200).json({
        success: true,
        message: 'Property approved successfully',
        data: property,
    });
});

//=====================================deny property (admin)=====================================
export const denyProperty = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const reason = typeof req.query.reason === 'string' ? req.query.reason.slice(0, 500) : ''; // reason comes from the query string
    
    const property = await propertyModel.findById(id).populate('owner', 'email userName');
    if (!property) return next(new AppError('Property not found', 404));
    
    // Email the owner before deleting (best effort); the event carries everything the email needs
    await dispatchEmail('property.denied', {
        propertyId: String(property._id),
        title: property.title,
        ownerName: property.contactInfo?.name,
        contactEmail: property.contactInfo?.email,
        reason,
    });
    
    // Delete the property and every reference to it (agency, wishlists, images)
    await propertyModel.deleteOne({ _id: property._id });
    await cleanupPropertyReferences(property);
    
    res.status(200).json({
        success: true,
        message: 'Property denied and deleted successfully',
        data: { id: id }
    });
});

//=====================================get properties for current user=====================================
export const getUserProperties = asyncHandler(async (req, res, next) => {
    if (!req.user || !req.user._id) {
        return next(new AppError('Authentication error: User ID is missing.', 401));
    }
    const properties = await propertyModel.find({ owner: req.user._id })
        .sort({ createdAt: -1 })
        .populate('owner', 'userName email')
        .populate('agent', 'userName email');
    res.status(200).json({
        success: true,
        count: properties.length,
        data: properties,
        message: 'User properties fetched successfully',
    });
});

//=====================================get similar properties (smart ranking)=====================================
export const getSimilarProperties = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const currentProperty = await propertyModel.findById(id);
    if (!currentProperty) {
        return res.status(404).json({ message: "Property not found" });
    }
    const priceMin = currentProperty.price * 0.8;
    const priceMax = currentProperty.price * 1.2;
    // public candidates sharing at least the governorate, the type or the price band
    const all = await propertyModel.find({
        _id: { $ne: currentProperty._id },
        $or: [
            { 'location.city': currentProperty.location?.city },
            ...(currentProperty.location?.governorate ? [{ 'location.governorate': currentProperty.location.governorate }] : []),
            { type: currentProperty.type },
            { price: { $gte: priceMin, $lte: priceMax } },
        ],
        ...PUBLIC_PROPERTY_FILTER,
    }).limit(200);
    // احسب درجة التشابه لكل عقار
    const scored = all.map(p => {
        let score = 0;
        if (p.location?.city === currentProperty.location?.city) score++;
        if (p.location?.governorate && p.location.governorate === currentProperty.location?.governorate) score++;
        if (p.type === currentProperty.type) score++;
        if (p.price >= priceMin && p.price <= priceMax) score++;
        if (p.area === currentProperty.area) score++;
        if (p.bedrooms === currentProperty.bedrooms) score++;
        return { property: p, score };
    });
    // رتب العقارات حسب درجة التشابه (الأعلى أولاً)
    scored.sort((a, b) => b.score - a.score);
    // أرجع أعلى 4 عقارات فقط
    const similar = scored.filter(s => s.score > 0).slice(0, 4).map(s => s.property);
    res.json({ success: true, data: similar });
});

//=====================================favorites/wishlist functions=====================================

// Add property to favorites (public listings only)
export const addToFavorites = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user._id;

    const property = await propertyModel.findById(id).select('isApproved isActive');
    if (!property || !isPublic(property)) {
        return next(new AppError('Property not found', 404));
    }

    // Atomic updates: no lost writes when requests overlap
    await propertyModel.updateOne({ _id: property._id }, { $addToSet: { favorites: userId } });
    await userModel.updateOne(
        { _id: userId, 'wishlist.property': { $ne: property._id } },
        { $push: { wishlist: { property: property._id, addedAt: new Date() } } }
    );

    res.status(200).json({
        success: true,
        message: 'Property added to favorites successfully',
        data: { propertyId: id }
    });
});

// Remove property from favorites
export const removeFromFavorites = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user._id;

    const property = await propertyModel.findById(id).select('_id');
    if (!property) {
        return next(new AppError('Property not found', 404));
    }

    await propertyModel.updateOne({ _id: property._id }, { $pull: { favorites: userId } });
    await userModel.updateOne({ _id: userId }, { $pull: { wishlist: { property: property._id } } });

    res.status(200).json({
        success: true,
        message: 'Property removed from favorites successfully',
        data: { propertyId: id }
    });
});

// Check if property is in user favorites
export const checkFavoriteStatus = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user._id;

    const user = await userModel.findById(userId).select('wishlist');
    const isFavorite = !!user?.wishlist?.some(item =>
        item?.property && item.property.toString() === id
    );

    res.status(200).json({
        success: true,
        data: { isFavorite }
    });
});
