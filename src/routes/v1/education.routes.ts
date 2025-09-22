import { Router } from 'express';
import { EducationController } from '../../controllers/education';
import { upload } from '../../config/cloudinary';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { handleValidationErrors } from '../../middlewares/validation.middleware';
import {
  createEducationValidator,
  updateEducationValidator,
  educationParamsValidator,
} from '../../validators/education.validator';

const router = Router();

// All education routes require authentication
router.use(authenticateToken);

// GET /education/levels - Get available education levels (public for authenticated users)
router.get('/levels', EducationController.getEducationLevels);

// GET /education - Get tutor's education
router.get('/', EducationController.getEducation);

// POST /education - Create education record
router.post(
  '/',
  upload.single('degree_image'), // Field name for degree image upload
  createEducationValidator,
  handleValidationErrors,
  EducationController.createEducation
);

// PUT /education/:educationId - Update education record
router.put(
  '/:educationId',
  upload.single('degree_image'), // Field name for degree image upload
  updateEducationValidator,
  handleValidationErrors,
  EducationController.updateEducation
);

// DELETE /education/:educationId - Delete education record
router.delete(
  '/:educationId',
  educationParamsValidator,
  handleValidationErrors,
  EducationController.deleteEducation
);

export default router;
