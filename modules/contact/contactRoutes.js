
import { Router } from "express";
import * as contactController from './contactController.js';
import { contactValidator, updateStatusValidator, deleteContactValidator } from './contactValidation.js';
import { protect, admin } from '../../middelWares/authMiddleware.js';
import { validation } from '../../middelWares/validation.js';

const router = Router();

// Public routes
router.post('/contact-us', validation(contactValidator), contactController.submitContactForm);

// Admin only routes
router.get('/get-all-contacts', contactController.getContacts);

router.put('/update-contact-status/:id',
    protect,
    admin,
    validation(updateStatusValidator),
    contactController.updateContactStatus
);

router.delete('/delete-contact/:id',
    validation(deleteContactValidator),
    contactController.deleteContact
);

export default router;
