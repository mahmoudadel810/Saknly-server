import Agency from '../../Model/AgencyModel.js';
import { asyncHandler, AppError } from '../../middelWares/errorMiddleware.js';
import { deleteMultipleImages } from '../../services/cloudinary.js';
import Property from '../../Model/PropertyModel.js';
import logger from '../../utils/logger.js';

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Best effort: a Cloudinary failure must not fail the request
const safeDeleteImages = async (publicIds) => {
  try {
    if (publicIds.length > 0) await deleteMultipleImages(publicIds);
  } catch (error) {
    logger.warn(`Failed to delete agency logo: ${error.message}`);
  }
};

// ==================== Get All Agencies (admin) ====================
export const getAllAgencies = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';

  const filter = search ? { name: { $regex: escapeRegex(search), $options: 'i' } } : {};

  const [agencies, total] = await Promise.all([
    Agency.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Agency.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: agencies,
    totalPages: Math.ceil(total / limit),
    total,
    page,
  });
});

// ==================== Get All Featured Agencies ====================
export const getFeaturedAgencies = asyncHandler(async (req, res) => {
  const featured = await Agency.find({ isFeatured: true });
  res.status(200).json({
    success: true,
    data: featured,
    message: 'Featured agencies fetched successfully'
  });
});

// ==================== Add New Agency ====================
export const addAgency = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError('شعار الوكالة مطلوب', 400));

  const { name, description, isFeatured } = req.body;

  const newAgency = await Agency.create({
    name,
    description,
    isFeatured,
    logo: {
      publicId: req.file.public_id,
      url: req.file.path,
    },
  });

  res.status(201).json({
    success: true,
    data: newAgency,
    message: 'Agency created successfully'
  });
});

// ==================== Update Agency ====================
export const updateAgency = asyncHandler(async (req, res, next) => {
  const agency = await Agency.findById(req.params.id);
  if (!agency) return next(new AppError('الوكالة غير موجودة', 404));

  const { name, description, isFeatured } = req.body;

  // Handle logo update
  const oldLogoId = req.file ? agency.logo?.publicId : null;
  if (req.file) {
    agency.logo = {
      publicId: req.file.public_id,
      url: req.file.path,
    };
  }

  agency.name = name || agency.name;
  agency.description = description ?? agency.description;
  agency.isFeatured = isFeatured ?? agency.isFeatured;

  await agency.save();

  // Old logo is removed only after the new one is saved
  if (oldLogoId) await safeDeleteImages([oldLogoId]);

  res.status(200).json({
    success: true,
    data: agency,
    message: 'Agency updated successfully'
  });
});

// ==================== Delete Agency ====================
export const deleteAgency = asyncHandler(async (req, res, next) => {
  const agency = await Agency.findById(req.params.id);
  if (!agency) return next(new AppError('الوكالة غير موجودة', 404));

  await agency.deleteOne();

  // Unlink its properties (they stay listed, without an agency)
  await Property.updateMany({ agency: agency._id }, { $unset: { agency: 1 } });
  if (agency.logo?.publicId) await safeDeleteImages([agency.logo.publicId]);

  res.status(200).json({
    success: true,
    message: 'Agency deleted successfully'
  });
});

// ==================== Get Agency by ID ====================
export const getAgencyById = asyncHandler(async (req, res, next) => {
  // Public page: only approved + active listings
  const agency = await Agency.findById(req.params.id)
    .populate({ path: 'properties', match: { isApproved: true, isActive: true } });
  if (!agency) return next(new AppError('الوكالة غير موجودة', 404));
  res.status(200).json({
    data: agency,
    message: 'Agency fetched successfully'
  });
});

// ==================== Toggle Agency Featured Status ====================
export const toggleAgencyFeatured = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { isFeatured } = req.body || {};

  const agency = await Agency.findById(id);
  if (!agency) return next(new AppError('الوكالة غير موجودة', 404));

  // Body {isFeatured: bool} sets the value; a missing body toggles it
  agency.isFeatured = typeof isFeatured === 'boolean' ? isFeatured : !agency.isFeatured;
  await agency.save();

  res.status(200).json({
    success: true,
    data: agency,
    message: `Agency ${agency.isFeatured ? 'featured' : 'unfeatured'} successfully`
  });
});
