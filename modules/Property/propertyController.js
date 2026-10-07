// server/modules/Property/PropertyController.js

import propertyModel from '../../Model/PropertyModel.js';
import { AppError, asyncHandler } from '../../middelWares/errorMiddleware.js';
import { deleteMultipleImages } from '../../services/cloudinary.js';
import ApiFeatures from '../../utils/apiFeatures.js';
import sendEmail from '../../services/sendEmail.js';
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

const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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
        (async () =>
        {
            const ids = (property.images || []).map(img => img.publicId).filter(Boolean);
            if (ids.length > 0) await deleteMultipleImages(ids);
        })(),
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
    const previousImageIds = property.images.map(img => img.publicId);

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
    const removedIds = previousImageIds.filter(publicId => publicId && !keptIds.has(publicId));
    if (removedIds.length > 0)
    {
        try
        {
            await deleteMultipleImages(removedIds);
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

    // Notify the owner (best effort)
    if (property.contactInfo && property.contactInfo.email) {
        try {
            await sendEmail({
                to: property.contactInfo.email,
                subject: 'تمت الموافقة على عقارك - سكنلي',
                message: `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');
                    
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    
                    body {
                        font-family: 'Cairo', sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
                        padding: 20px;
                        min-height: 100vh;
                    }
                    
                    .email-container {
                        max-width: 650px;
                        margin: 0 auto;
                        background: rgba(255, 255, 255, 0.95);
                        backdrop-filter: blur(20px);
                        border-radius: 24px;
                        overflow: hidden;
                        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                    }
                    
                    .header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        padding: 45px 30px;
                        text-align: center;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .header::before {
                        content: '';
                        position: absolute;
                        top: -50%;
                        left: -50%;
                        width: 200%;
                        height: 200%;
                        background: repeating-linear-gradient(45deg, transparent, transparent 15px, rgba(255,255,255,0.08) 15px, rgba(255,255,255,0.08) 30px);
                        animation: float 25s linear infinite;
                    }
                    
                    @keyframes float {
                        0% { transform: translateX(-50px) translateY(-50px) rotate(0deg); }
                        100% { transform: translateX(-50px) translateY(-50px) rotate(360deg); }
                    }
                    
                    .header h1 {
                        color: #ffffff;
                        margin: 0;
                        font-size: 32px;
                        font-weight: 700;
                        position: relative;
                        z-index: 2;
                        text-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    }
                    
                    .header p {
                        color: #ffffff;
                        margin: 15px 0 0 0;
                        font-size: 18px;
                        opacity: 0.95;
                        position: relative;
                        z-index: 2;
                        font-weight: 400;
                    }
                    
                    .success-icon {
                        width: 80px;
                        height: 80px;
                        background: rgba(255,255,255,0.2);
                        border-radius: 50%;
                        margin: 20px auto 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        position: relative;
                        z-index: 2;
                    }
                    
                    .success-icon::before {
                        content: '✓';
                        color: white;
                        font-size: 40px;
                        font-weight: bold;
                    }
                    
                    .content { padding: 45px 35px; }
                    
                    .welcome-section {
                        text-align: center;
                        margin-bottom: 35px;
                    }
                    
                    .welcome-section h2 {
                        color: #2c3e50;
                        margin: 0 0 15px 0;
                        font-size: 28px;
                        font-weight: 700;
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                    }
                    
                    .welcome-section p {
                        color: #7f8c8d;
                        margin: 0;
                        font-size: 18px;
                        font-weight: 400;
                    }
                    
                    .info-card {
                        background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
                        border-radius: 16px;
                        padding: 30px;
                        margin-bottom: 30px;
                        border: 1px solid rgba(102, 126, 234, 0.1);
                        box-shadow: 0 10px 30px rgba(0,0,0,0.05);
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .info-card::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 4px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    }
                    
                    .info-card p {
                        color: #2c3e50;
                        line-height: 1.8;
                        margin-bottom: 20px;
                        font-size: 17px;
                        font-weight: 400;
                    }
                    
                    .property-title {
                        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                        border: 2px solid transparent;
                        background-clip: padding-box;
                        border-radius: 12px;
                        padding: 20px;
                        margin: 25px 0;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .property-title::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        margin: -2px;
                        border-radius: inherit;
                        z-index: -1;
                    }
                    
                    .property-title h3 {
                        color: #2c3e50;
                        margin: 0;
                        font-size: 20px;
                        font-weight: 600;
                        text-align: center;
                    }
                    
                    .features-card {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border-radius: 16px;
                        padding: 35px;
                        text-align: center;
                        margin-bottom: 30px;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .features-card h3 {
                        color: #ffffff;
                        margin: 0 0 25px 0;
                        font-size: 24px;
                        font-weight: 700;
                        position: relative;
                        z-index: 2;
                    }
                    
                    .features-list {
                        list-style: none;
                        padding: 0;
                        margin: 0;
                        position: relative;
                        z-index: 2;
                    }
                    
                    .features-list li {
                        color: #ffffff;
                        margin-bottom: 15px;
                        font-size: 17px;
                        font-weight: 400;
                        padding: 12px 20px;
                        background: rgba(255,255,255,0.1);
                        border-radius: 25px;
                        backdrop-filter: blur(10px);
                        border: 1px solid rgba(255,255,255,0.2);
                        position: relative;
                    }
                    
                    .features-list li::before {
                        content: '🏠';
                        margin-left: 10px;
                        font-size: 18px;
                    }
                    
                    .cta-section {
                        text-align: center;
                        margin: 40px 0;
                    }
                    
                    .cta-button {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: #ffffff;
                        padding: 18px 40px;
                        text-decoration: none;
                        border-radius: 30px;
                        font-weight: 600;
                        font-size: 18px;
                        display: inline-block;
                        box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
                        transition: all 0.3s ease;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .footer {
                        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                        padding: 30px;
                        text-align: center;
                        border-top: 1px solid rgba(102, 126, 234, 0.1);
                    }
                    
                    .footer p:first-child {
                        color: #6c757d;
                        margin: 0 0 15px 0;
                        font-size: 16px;
                        font-weight: 500;
                    }
                    
                    .footer p:last-child {
                        color: #adb5bd;
                        margin: 0;
                        font-size: 14px;
                        font-weight: 400;
                    }
                    
                    @media (max-width: 600px) {
                        .email-container { margin: 10px; border-radius: 16px; }
                        .header { padding: 30px 20px; }
                        .header h1 { font-size: 26px; }
                        .content { padding: 30px 20px; }
                        .welcome-section h2 { font-size: 24px; }
                        .info-card, .features-card { padding: 25px 20px; }
                        .cta-button { padding: 15px 30px; font-size: 16px; }
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <!-- Header -->
                    <div class="header">
                        <h1>تمت الموافقة على عقارك</h1>
                        <p>مرحباً بك في سكنلي</p>
                        <div class="success-icon"></div>
                    </div>
                    
                    <!-- Content -->
                    <div class="content">
                        <div class="welcome-section">
                            <h2>تمت الموافقة بنجاح</h2>
                            <p>عقارك جاهز للعرض على المنصة</p>
                        </div>
                        
                        <div class="info-card">
                            <p>
                                مرحباً <strong>${escapeHtml(property.contactInfo.name) || 'عزيزي العميل'}</strong>،
                            </p>
                            <p>
                                تمت الموافقة على عقارك بعنوان:
                            </p>
                            <div class="property-title">
                                <h3>${escapeHtml(property.title)}</h3>
                            </div>
                        </div>
                        
                        <div class="features-card">
                            <h3>ما يحدث الآن؟</h3>
                            <ul class="features-list">
                                <li>عقارك سيظهر في نتائج البحث</li>
                                <li>يمكن للعملاء التواصل معك مباشرة</li>
                                <li>ستحصل على إشعارات عند وجود استفسارات</li>
                            </ul>
                        </div>
                        
                        <div class="cta-section">
                            <a href="${clientUrl()}" class="cta-button">
                                تصفح المنصة
                            </a>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div class="footer">
                        <p>شكراً لك على استخدام منصة سكنلي</p>
                        <p>© 2024 سكنلي. جميع الحقوق محفوظة.</p>
                    </div>
                </div>
            </body>
            </html>
        `
            });
        } catch (error) {
            logger.warn(`Approval email for property ${property._id} failed: ${error.message}`);
        }
    }

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
    
    // Send email to owner before deleting (best effort)
    if (property.contactInfo && property.contactInfo.email) {
        try {
            await sendEmail({
                to: property.contactInfo.email,
                subject: 'تحديث بخصوص عقارك',
                message: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); padding: 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">تحديث بخصوص عقارك</h1>
                        <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">منصة سكنلي</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 40px 30px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <div style="background-color: #f8d7da; border: 2px solid #f5c6cb; border-radius: 50px; width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                                <span style="font-size: 40px; color: #721c24;">⚠️</span>
                            </div>
                            <h2 style="color: #2c3e50; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">عذراً، لم يتم قبول عقارك</h2>
                            <p style="color: #7f8c8d; margin: 0; font-size: 16px;">يرجى مراجعة التفاصيل أدناه</p>
                        </div>
                        
                        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
                            <p style="color: #2c3e50; line-height: 1.6; margin-bottom: 20px; font-size: 16px;">
                                مرحباً <strong>${escapeHtml(property.contactInfo.name)}</strong>،
                            </p>
                            <p style="color: #2c3e50; line-height: 1.6; margin-bottom: 20px; font-size: 16px;">
                                نعتذر، لم يتم قبول عقارك بعنوان:
                            </p>
                            <div style="background-color: #ffffff; border-left: 4px solid #ff6b6b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                                <h3 style="color: #2c3e50; margin: 0; font-size: 18px; font-weight: 600;">${escapeHtml(property.title)}</h3>
                            </div>
                        </div>
                        
                        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); border-radius: 8px; padding: 25px; text-align: center; margin-bottom: 25px;">
                            <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">سبب الرفض:</h3>
                            <div style="background-color: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 20px; margin: 15px 0;">
                                <p style="color: #ffffff; margin: 0; font-size: 16px; line-height: 1.6;">${escapeHtml(reason) || 'غير محدد'}</p>
                            </div>
                        </div>
                        
                        <div style="background-color: #e3f2fd; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
                            <h3 style="color: #1976d2; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">نصائح للتحسين:</h3>
                            <ul style="color: #2c3e50; margin: 0; padding-left: 20px;">
                                <li style="margin-bottom: 8px;">تأكد من صحة جميع المعلومات المقدمة</li>
                                <li style="margin-bottom: 8px;">أضف صور واضحة وعالية الجودة</li>
                                <li style="margin-bottom: 8px;">اكتب وصفاً مفصلاً ومفيداً</li>
                                <li style="margin-bottom: 8px;">تأكد من أن السعر مناسب للسوق</li>
                            </ul>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${clientUrl()}/uploadProperty" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                                إضافة عقار جديد
                            </a>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #e9ecef;">
                        <p style="color: #6c757d; margin: 0 0 10px 0; font-size: 14px;">شكراً لك على استخدام منصة سكنلي</p>
                        <p style="color: #adb5bd; margin: 0; font-size: 12px;">© 2024 سكنلي. جميع الحقوق محفوظة.</p>
                    </div>
                </div>
            `
            });
        } catch (error) {
            logger.warn(`Rejection email for property ${property._id} failed: ${error.message}`);
        }
    }
    
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
    // public candidates sharing at least the city, the type or the price band
    const all = await propertyModel.find({
        _id: { $ne: currentProperty._id },
        $or: [
            { 'location.city': currentProperty.location?.city },
            { type: currentProperty.type },
            { price: { $gte: priceMin, $lte: priceMax } },
        ],
        ...PUBLIC_PROPERTY_FILTER,
    }).limit(200);
    // احسب درجة التشابه لكل عقار
    const scored = all.map(p => {
        let score = 0;
        if (p.location?.city === currentProperty.location?.city) score++;
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
