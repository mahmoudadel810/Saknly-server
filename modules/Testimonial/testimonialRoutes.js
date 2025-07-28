import { Router } from "express";
import * as testimonialController from "./testimonialController.js";
import { protect, admin } from "../../middelWares/authMiddleware.js";

const router = Router();

// إضافة رأي جديد (مفتوح للجميع)
router.post("/", testimonialController.addTestimonial);
// جلب الآراء (فلترة عبر query)
router.get("/", testimonialController.getTestimonials);
// تحديث حالة رأي (قبول/رفض) - أدمن فقط
router.put("/:id/status", testimonialController.updateTestimonialStatus);
// حذف رأي - أدمن فقط
router.delete("/:id", testimonialController.deleteTestimonial);

export default router; 