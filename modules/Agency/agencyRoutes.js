import express from 'express';
import * as agencyController from './agencyController.js';
import { validation } from '../../middelWares/validation.js';
import { addAgencyValidator, updateAgencyValidator } from './agencyValidation.js';
import { createUploader, allowedMimeTypes } from '../../utils/multer.js';
import { protect, authorize } from '../../middelWares/authMiddleware.js';

const router = express.Router();
const uploader = createUploader(allowedMimeTypes.image);

router.get('/featured', agencyController.getFeaturedAgencies);

router.post(
  '/',
 // protect,
 // authorize('admin'),
  uploader.single('logo'),
  validation(addAgencyValidator),
  agencyController.addAgency
);

router.put(
  '/:id',
  //protect,
  //authorize('admin'),
  uploader.single('logo'),
  validation(updateAgencyValidator),
  agencyController.updateAgency
);

router.delete(
  '/:id',
  //protect,
 // authorize('admin'),
  agencyController.deleteAgency
);

router.get('/:id', agencyController.getAgencyById);

router.patch(
  '/:id/feature',
  protect,
  authorize('admin'),
  agencyController.toggleAgencyFeatured
);

export default router;
