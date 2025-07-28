import express from "express";
import * as propertyInquiryController from "./propertyInquiryController.js";
import { protect, authorize } from "../../../middelWares/authMiddleware.js";
import { validation } from "../../../middelWares/validation.js";
import { createInquiryValidator, updateInquiryStatusValidator } from "./propertyInquiryValidation.js";

const router = express.Router();

// Public routes
router.post("/add-property-inquiry", validation(createInquiryValidator), propertyInquiryController.createPropertyInquiry);

// Protected routes (Admin & Agent only)
router.get("/get-all-property-inquiries", protect, authorize("admin", "agent"), propertyInquiryController.getPropertyInquiries);
router.get("/get-property-inquiry-by-id/:id", protect, authorize("admin", "agent"), propertyInquiryController.getPropertyInquiryById);
router.put("/update-property-inquiry-status/:id", protect, authorize("admin", "agent"), validation(updateInquiryStatusValidator), propertyInquiryController.updateInquiryStatus);

router.delete("/delete-property-inquiry/:id", protect, authorize("admin"), propertyInquiryController.deletePropertyInquiry);
router.get("/get-inquiry-stats", protect, authorize("admin"), propertyInquiryController.getInquiryStats);


export default router;
