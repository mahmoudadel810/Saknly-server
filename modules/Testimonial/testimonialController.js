import Testimonial from "../../Model/TestimonialModel.js";
import { asyncHandler, AppError } from "../../middelWares/errorMiddleware.js";

// إضافة رأي جديد
export const addTestimonial = asyncHandler(async (req, res, next) => {
  const { name, text, image, role, type, propertyId, agencyId } = req.body;
  if (!name || !text || !type) {
    return next(new AppError("الاسم والرأي والنوع مطلوبين", 400));
  }
  
  // Auto-approve agency testimonials
  const status = type === "agency" ? "approved" : "pending";
  
  const testimonial = await Testimonial.create({
    name,
    text,
    image,
    role,
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

// جلب الآراء مع فلترة
export const getTestimonials = asyncHandler(async (req, res, next) => {
  const { status, type, propertyId, agencyId } = req.query;
  let filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (propertyId) filter.propertyId = propertyId;
  if (agencyId) filter.agencyId = agencyId;
  const testimonials = await Testimonial.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: testimonials });
});

// تحديث حالة رأي (قبول/رفض)
export const updateTestimonialStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
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