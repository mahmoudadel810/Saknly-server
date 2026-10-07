import { Router } from "express";
import * as testimonialController from "./testimonialController.js";
import { protect, admin, optionalAuth } from "../../middelWares/authMiddleware.js";
import { validation } from "../../middelWares/validation.js";
import { addTestimonialValidator, updateTestimonialStatusValidator } from "./testimonialValidation.js";

const router = Router();

// إضافة رأي جديد (مفتوح للجميع) - يبدأ دائماً "pending" حتى يوافق الأدمن
router.post("/", validation(addTestimonialValidator), testimonialController.addTestimonial);
// كل الآراء بأي حالة - أدمن فقط (?status=&type=&propertyId=&agencyId=)
router.get("/all", protect, admin, testimonialController.getAllTestimonials);
// جلب الآراء (فلترة عبر query) - المعتمدة فقط إلا للأدمن
router.get("/", optionalAuth, testimonialController.getTestimonials);
// تحديث حالة رأي (قبول/رفض) - أدمن فقط
router.put("/:id/status", protect, admin, validation(updateTestimonialStatusValidator), testimonialController.updateTestimonialStatus);
// حذف رأي - أدمن فقط
router.delete("/:id", protect, admin, testimonialController.deleteTestimonial);

export default router;
