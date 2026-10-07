import Testimonial from "../../Model/TestimonialModel.js";
import { asyncHandler, AppError } from "../../middelWares/errorMiddleware.js";

// إضافة رأي جديد
export const addTestimonial = asyncHandler(async (req, res, next) => {
  const { name, text, image, role, type, propertyId, agencyId } = req.body;
  if (!name || !text || !type) {
    return next(new AppError("الاسم والرأي والنوع مطلوبين", 400));
  }
  
  // Every new testimonial waits for admin review
  const status = "pending";
  
  const testimonial = await Testimonial.create({
    name,
    text,
    image: image || "",
    ...(role && { role }),
    type,
    status, // Set status here
    propertyId: type === "property" ? propertyId : null,
    agencyId: type === "agency" ? agencyId : null,
  });
  
  // Update the response message based on status
  const message = status === "approved" 
    ? "تم إضافة الرأي بنجاح" 
    : "تم إرسال رأيك بنجاح! سيتم مراجعته من الإدارة.";
    
  res.status(201).json({ 
    success: true, 
    message,
    data: testimonial 
  });
});

const VALID_STATUSES = ["pending", "approved", "rejected"];
const VALID_TYPES = ["general", "property", "agency"];
const isObjectId = (value) => typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value);

const buildTestimonialFilter = (query, allowAnyStatus) => {
  const { status, type, propertyId, agencyId } = query;
  const filter = {};
  if (allowAnyStatus) {
    if (VALID_STATUSES.includes(status)) filter.status = status;
  } else {
    // Public visitors only ever see approved testimonials
    filter.status = "approved";
  }
  if (VALID_TYPES.includes(type)) filter.type = type;
  if (isObjectId(propertyId)) filter.propertyId = propertyId;
  if (isObjectId(agencyId)) filter.agencyId = agencyId;
  return filter;
};

// جلب الآراء مع فلترة (المعتمدة فقط، إلا لو الطالب أدمن ومرر status)
export const getTestimonials = asyncHandler(async (req, res, next) => {
  const isAdmin = req.user?.role === "admin";
  const filter = buildTestimonialFilter(req.query, isAdmin && !!req.query.status);
  const testimonials = await Testimonial.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: testimonials });
});

// كل الآراء لأي حالة (أدمن فقط)
export const getAllTestimonials = asyncHandler(async (req, res, next) => {
  const filter = buildTestimonialFilter(req.query, true);
  const testimonials = await Testimonial.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: testimonials });
});

// تحديث حالة رأي (قبول/رفض)
export const updateTestimonialStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return next(new AppError("الحالة غير صحيحة", 400));
  }
  const testimonial = await Testimonial.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  );
  if (!testimonial) return next(new AppError("الرأي غير موجود", 404));
  res.status(200).json({ success: true, data: testimonial });
});

// حذف رأي
export const deleteTestimonial = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const testimonial = await Testimonial.findByIdAndDelete(id);
  if (!testimonial) return next(new AppError("الرأي غير موجود", 404));
  res.status(200).json({ success: true, message: "تم الحذف بنجاح" });
}); 