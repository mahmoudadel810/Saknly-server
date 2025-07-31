// server/modules/Property/PropertyController.js

import propertyModel, { SaleProperty, RentProperty, StudentProperty } from '../../Model/PropertyModel.js';
import { AppError, asyncHandler } from '../../middelWares/errorMiddleware.js';
import { deleteMultipleImages } from '../../services/cloudinary.js';
import ApiFeatures from '../../utils/apiFeatures.js';
import sendEmail from '../../services/sendEmail.js';
import userModel from '../../Model/UserModel.js';
import Agency from '../../Model/AgencyModel.js';

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


//=====================================get all properties=====================================
export const getAllProperties = asyncHandler(async (req, res, next) =>
{
    // Temporarily include pending properties for testing
    const baseQuery = propertyModel.find({});

   
    const countQuery = baseQuery.clone();
    const countApiFeatures = new ApiFeatures(countQuery, req.query)
        .filter()
        .search(); 

    const totalDocs = await countApiFeatures.mongooseQuery.countDocuments();
    const dataApiFeatures = new ApiFeatures(baseQuery, req.query)
        .filter()
        .search()
        .sort()
        .limitFields()
        .paginate(); 


    const properties = await dataApiFeatures.mongooseQuery
        .populate('owner', 'userName email')
        .populate('agent', 'userName email');

  
    if (properties.length === 0 && totalDocs === 0) {
        return res.status(200).json({
            success: true,
            data: [],
            message: 'No properties found matching your criteria.',
            pagination: {
                currentPage: req.query.page * 1 || 1,
                totalPages: 0,
                totalDocs: 0,
                itemsPerPage: req.query.limit * 1 || 10,
                hasNext: false,
                hasPrev: false,
            }
        });
    }

    const currentPage = req.query.page * 1 || 1;
    const itemsPerPage = req.query.limit * 1 || 10;
    const totalPages = Math.ceil(totalDocs / itemsPerPage); 

    res.status(200).json({
        success: true,
        data: properties,
        message: 'Properties fetched successfully',
        pagination: {
            currentPage,
            totalPages,
            totalDocs,
            itemsPerPage,
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1,
        }
    });
});


//=====================================get property details=====================================

export const getPropertyDetails = asyncHandler(async (req, res, next) =>
{
    const { _id } = req.params;
    const property = await propertyModel.findById(_id)
        .populate('owner', 'userName email phoneNumber')
        .populate('agent', 'userName email phoneNumber')
        .populate('approvedBy', 'userName email');

    if (!property)
    {
        return res.status(200).json({
            success: true,
            data: ['Property not found, try again later'],
            message: 'Property not found',
        });
    }

    await property.incrementViews();

    res.status(200).json({
        success: true,
        data: property,
        message: 'Property details fetched successfully',
    });
});

//=====================================search properties=====================================

export const searchProperties = asyncHandler(async (req, res, next) => {
    // Apply API features for filtering, sorting, pagination, etc.
    const features = new ApiFeatures(propertyModel.find({
        isApproved: true, 
        isActive: true    
    }), req.query)
        .filter()
        .search()
        .sort()
        .limitFields()
        .search()
        .paginate();

    const properties = await features.mongooseQuery
        .populate('owner', 'userName email')
        .populate('agent', 'userName email');

    if (properties.length === 0) {
        return res.status(200).json({
            success: true,
            data: ['No properties found with the specified criteria'],
            message: 'No properties found',
        });
    }

    res.status(200).json({
        success: true,
        count: properties.length,
        data: properties,
        message: 'Properties fetched successfully based on search criteria',
    });
});


//=====================================add property=====================================

export const addProperty = asyncHandler(async (req, res, next) =>
{
    console.log('=== ADD PROPERTY DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Uploaded files:', req.files);
    console.log('User:', req.user);
    console.log('File fieldnames:', req.files ? req.files.map(f => f.fieldname) : 'No files');
    console.log('All request fields:', Object.keys(req.body || {}));
    
    const { category, ...propertyData } = req.body;
    const uploadedFiles = req.files;

    // 2. Validate category
    if (!category || !['sale', 'rent', 'student'].includes(category)) {
        return next(new AppError('Invalid property category provided. Must be: sale, rent, or student.', 400));
    }

    // 3. Ensure the user is authenticated
    if (!req.user || !req.user._id)
    {
        return next(new AppError('Authentication error: User ID is missing.', 401));
    }
 
    // 4. Map uploaded files to the format required by the Property schema
    console.log('Processing uploaded files:', uploadedFiles);
    const mediaLinks = (uploadedFiles || []).map(file => {
        console.log('Processing file:', file);
        console.log('File fieldname:', file.fieldname);
        return {
            publicId: file.public_id, // Corrected from file.filename
            url: file.path,           // secure_url from Cloudinary
            isMain: false
        };
    });

    // 5. Designate the first uploaded file as the main image/media
    if (mediaLinks.length > 0)
    {
        mediaLinks[0].isMain = true;
    }

    // 6. Create a new property instance with all data
    let newPropertyData = {
        ...propertyData,
        category: category, // Add category to the data
        owner: req.user._id,
        images: mediaLinks,
    };

    // Handle location coordinates if provided
    if (req.body['location[latitude]'] && req.body['location[longitude]']) {
        newPropertyData.location = {
            ...newPropertyData.location,
            latitude: parseFloat(req.body['location[latitude]']),
            longitude: parseFloat(req.body['location[longitude]'])
        };
    }
    
    if (req.user.role === 'user') {
        newPropertyData.status = 'pending';
        newPropertyData.isApproved = false;
        newPropertyData.isActive = false;
    } else {
        newPropertyData.status = 'available';
        newPropertyData.isApproved = true;
        newPropertyData.isActive = true;
        newPropertyData.approvedBy = req.user._id;
        newPropertyData.approvedAt = new Date();
    }
    
    // 7. Use the base Property model - Mongoose will automatically use the correct discriminator based on category
    console.log('Creating property with data:', newPropertyData);
    const newProperty = new propertyModel(newPropertyData);

    // 8. Save the new property to the database
    console.log('Saving property to database...');
    try {
        await newProperty.save();
        console.log('Property saved successfully:', newProperty._id);
    } catch (error) {
        console.error('Error saving property:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        throw error;
    }

    // 9. If property has an agency, push its ID to the agency's properties array
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

export const updateProperty = asyncHandler(async (req, res, next) =>
{
    const { id } = req.params;
    const { _id, category, imagesToDelete, ...updateData } = req.body;
    const newFiles = req.files;

    let property = await propertyModel.findById(id);
    if (!property) return next(new AppError('Property not found', 404));

    if (req.user.role !== 'admin' && req.user.role !== 'agent' !== req.user.id.toString())
        return next(new AppError('User is not authorized to update this property', 403));

    let finalImagesList = property.images || [];

    if (Array.isArray(imagesToDelete) && imagesToDelete.length > 0)
    {
        await deleteMultipleImages(imagesToDelete);
        finalImagesList = finalImagesList.filter(img => !imagesToDelete.includes(img.publicId));
    }

    const newlyUploadedImages = (newFiles || []).map(file => ({
        publicId: file.public_id, // Corrected from file.filename
        url: file.path,
        isMain: false,
    }));

    finalImagesList = [...finalImagesList, ...newlyUploadedImages];

    if (Array.isArray(updateData.images))
    {
        const frontendManagedImages = updateData.images;
        const combinedImages = [];
        const processedIds = new Set();

        newlyUploadedImages.forEach(img =>
        {
            combinedImages.push(img);
            processedIds.add(img.publicId);
        });

        frontendManagedImages.forEach(img =>
        {
            if (img.publicId && !processedIds.has(img.publicId))
            {
                const dbImg = property.images.find(db => db.publicId === img.publicId);
                if (dbImg)
                {
                    combinedImages.push({
                        publicId: img.publicId,
                        url: dbImg.url,
                        isMain: img.isMain || false,
                    });
                }
            }
        });

        finalImagesList = combinedImages;
        delete updateData.images;
    }

    if (finalImagesList.length > 0 && !finalImagesList.some(img => img.isMain))
    {
        finalImagesList[0].isMain = true;
    }
    updateData.images = finalImagesList;

    property = await propertyModel.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
    });

    res.status(200).json({
        success: true,
        data: property,
        message: 'Property updated successfully',
    });
});

//=====================================delete property================================================

export const deleteProperty = asyncHandler(async (req, res, next) =>
{
    const { id } = req.params;
    const property = await propertyModel.findById(id);

    if (!property) return next(new AppError('Property not found', 404));

    if (req.user.role !== 'admin' && req.user.role !== 'agent' !== req.user.id.toString())
        return next(new AppError('User is not authorized to delete this property', 403));

    if (property.images?.length > 0)
    {
        const idsToDelete = property.images.map(img => img.publicId);
        await deleteMultipleImages(idsToDelete);
    }

    // Remove property ID from agency's properties array if it has an agency
    if (property.agency) {
      await Agency.findByIdAndUpdate(property.agency, { $pull: { properties: property._id } });
    }

    await property.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Property deleted successfully',
    });
});

//=====================================get most viewed properties=====================================

// get most viewed properties (for home page)
export const getMostViewedProperties = asyncHandler(async (req, res, next) =>
{
    const properties = await propertyModel.find({})
        .sort({ views: -1 })
        .limit(10)
        .populate('owner', 'userName email')
        .populate('agent', 'userName email');

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
        // Property types are already in Arabic in the model, so no translation needed
        // Translate status to Arabic
        if (propertyObject.status) {
            propertyObject.status = translateText(propertyObject.status);
        }
        propertyObject.sliderImages = propertyObject.images.map(img => img.url);
        return propertyObject;
    });

    res.status(200).json({
        success: true,
        count: processedProperties.length,
        data: processedProperties,
        message: 'Most viewed active and approved properties fetched successfully',
    });
});
//===================================== طبعا يا حودا عاوز تمسح الكلام دا كله امسحه :) =====================================
//===================================== طبعا يا حودا عاوز تمسح الكلام دا كله امسحه :) =====================================
//===================================== طبعا يا حودا عاوز تمسح الكلام دا كله امسحه :) =====================================
//===================================== طبعا يا حودا عاوز تمسح الكلام دا كله امسحه :) =====================================
//===================================== طبعا يا حودا عاوز تمسح الكلام دا كله امسحه :) =====================================
//===================================== طبعا يا حودا عاوز تمسح الكلام دا كله امسحه :) =====================================
//===================================== طبعا يا حودا عاوز تمسح الكلام دا كله امسحه :) =====================================
//===================================== طبعا يا حودا عاوز تمسح الكلام دا كله امسحه :) =====================================

//=====================================get all pending properties (admin)=====================================
export const getPendingProperties = asyncHandler(async (req, res, next) => {
    const { category } = req.query; // category: sale, rent, student
    const filter = { status: 'pending' };
    if (category) {
        filter.category = category;
    }
    const properties = await propertyModel.find(filter)
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
    const { status, isActive, isApproved } = req.body; // Get data from request body
    
    console.log('Approve Property Request:', {
        id,
        body: req.body,
        status,
        isActive,
        isApproved
    });
    
    const property = await propertyModel.findById(id).populate('owner', 'email userName');
    if (!property) return next(new AppError('Property not found', 404));
    
    // Update property with the provided data
    property.status = status || 'available';
    property.isActive = isActive !== undefined ? isActive : true;
    property.isApproved = isApproved !== undefined ? isApproved : true;
    property.approvedBy = req.user?._id || null; // Safe access with fallback
    property.approvedAt = new Date();
    await property.save();
    
    console.log('Property updated successfully:', {
        id: property._id,
        status: property.status,
        isActive: property.isActive,
        isApproved: property.isApproved
    });
    
    // Send email to owner
   // Send email to owner
if (property.contactInfo && property.contactInfo.email) {
    console.log('Sending approval email to:', property.contactInfo.email);
    const emailed = await sendEmail({
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
                                مرحباً <strong>${property.contactInfo.name || 'عزيزي العميل'}</strong>،
                            </p>
                            <p>
                                تمت الموافقة على عقارك بعنوان:
                            </p>
                            <div class="property-title">
                                <h3>${property.title}</h3>
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
                            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" class="cta-button">
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

    if (!emailed) {
        console.error('Failed to send approval email to:', property.contactInfo.email);
    } else {
        console.log('Approval email sent successfully to:', property.contactInfo.email);
    }
} else {
    console.log('No contact info found for property:', property._id);
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
    const { reason } = req.query; // Get reason from query parameters instead of body
    
    const property = await propertyModel.findById(id).populate('owner', 'email userName');
    if (!property) return next(new AppError('Property not found', 404));
    
    // Send email to owner before deleting
    if (property.contactInfo && property.contactInfo.email) {
        const emailed = await sendEmail({
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
                                مرحباً <strong>${property.contactInfo.name || ''}</strong>،
                            </p>
                            <p style="color: #2c3e50; line-height: 1.6; margin-bottom: 20px; font-size: 16px;">
                                نعتذر، لم يتم قبول عقارك بعنوان:
                            </p>
                            <div style="background-color: #ffffff; border-left: 4px solid #ff6b6b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                                <h3 style="color: #2c3e50; margin: 0; font-size: 18px; font-weight: 600;">${property.title}</h3>
                            </div>
                        </div>
                        
                        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); border-radius: 8px; padding: 25px; text-align: center; margin-bottom: 25px;">
                            <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">سبب الرفض:</h3>
                            <div style="background-color: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 20px; margin: 15px 0;">
                                <p style="color: #ffffff; margin: 0; font-size: 16px; line-height: 1.6;">${reason || 'غير محدد'}</p>
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
                            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/uploadProperty" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
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

        if (!emailed) {
            console.error('Failed to send rejection email to:', property.contactInfo.email);
        }
    }
    
    // Delete the property from database
    await propertyModel.findByIdAndDelete(id);
    
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
    // اجلب كل العقارات الفعالة والمعتمدة باستثناء العقار الحالي
    const all = await propertyModel.find({
        _id: { $ne: id },
        isApproved: true,
        isActive: true
    });
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

// Add property to favorites
export const addToFavorites = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user._id;

    const property = await propertyModel.findById(id);
    if (!property) {
        return next(new AppError('Property not found', 404));
    }

    // Add user to property favorites
    await property.addToFavorites(userId);

    // Add property to user wishlist
    const user = await userModel.findById(userId);
    const existingWishlistItem = user.wishlist.find(item => 
        item.property.toString() === id
    );

    if (!existingWishlistItem) {
        user.wishlist.push({
            property: id,
            addedAt: new Date()
        });
        await user.save();
    }

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

    const property = await propertyModel.findById(id);
    if (!property) {
        return next(new AppError('Property not found', 404));
    }

    // Remove user from property favorites
    await property.removeFromFavorites(userId);

    // Remove property from user wishlist
    const user = await userModel.findById(userId);
    user.wishlist = user.wishlist.filter(item => 
        item.property.toString() !== id
    );
    await user.save();

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

    const user = await userModel.findById(userId);
    const isFavorite = user.wishlist.some(item => 
        item.property.toString() === id
    );

    res.status(200).json({
        success: true,
        data: { isFavorite }
    });
});