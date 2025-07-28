import Agency from '../../Model/AgencyModel.js';
import { asyncHandler, AppError } from '../../middelWares/errorMiddleware.js';
import { deleteMultipleImages } from '../../services/cloudinary.js';

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
      publicId: req.file.filename,
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
  if (req.file) {
    if (agency.logo?.publicId) await deleteMultipleImages([agency.logo.publicId]);
    agency.logo = {
      publicId: req.file.filename,
      url: req.file.path,
    };
  }

  agency.name = name || agency.name;
  agency.description = description || agency.description;
  agency.isFeatured = isFeatured ?? agency.isFeatured;

  await agency.save();

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

  if (agency.logo?.publicId) await deleteMultipleImages([agency.logo.publicId]);
  await agency.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Agency deleted successfully'
  });
});

// ==================== Get Agency by ID ====================
export const getAgencyById = asyncHandler(async (req, res, next) => {
  const agency = await Agency.findById(req.params.id)
    .populate('properties');
  if (!agency) return next(new AppError('الوكالة غير موجودة', 404));
  res.status(200).json({
    data: agency,
    message: 'Agency fetched successfully'
  });
});

// ==================== Toggle Agency Featured Status ====================
export const toggleAgencyFeatured = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { isFeatured } = req.body;

  const agency = await Agency.findById(id);
  if (!agency) return next(new AppError('الوكالة غير موجودة', 404));

  agency.isFeatured = isFeatured;
  await agency.save();

  res.status(200).json({
    success: true,
    data: agency,
    message: `Agency ${isFeatured ? 'featured' : 'unfeatured'} successfully`
  });
});
