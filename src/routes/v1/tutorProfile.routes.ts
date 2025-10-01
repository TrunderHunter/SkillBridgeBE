import { Router } from 'express';
import {
  TutorProfileController,
  CCCDController,
} from '../../controllers/tutor';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { handleValidationErrors } from '../../middlewares/validation.middleware';
import { upload } from '../../config/cloudinary';
import { validateTutorProfile } from '../../validators/tutorProfile.validator';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get tutor profile (personal info + tutor profile)
router.get('/profile', TutorProfileController.getProfile);

// Update personal info (User model fields)
router.put(
  '/profile/personal',
  upload.single('avatar_url'),
  validateTutorProfile.updatePersonalInfo,
  handleValidationErrors,
  TutorProfileController.updatePersonalInfo
);

// Update tutor profile introduction
router.put(
  '/profile/introduction',
  validateTutorProfile.updateIntroduction,
  handleValidationErrors,
  TutorProfileController.updateIntroduction
);

// Verification routes
router.get(
  '/profile/check-edit-status',
  TutorProfileController.checkEditStatus
);
router.post(
  '/profile/submit-verification',
  TutorProfileController.submitForVerification
);

// CCCD routes
router.get('/cccd', CCCDController.getImages);
router.post(
  '/cccd/upload',
  upload.array('cccd_images', 10),
  CCCDController.uploadImages
);
router.delete('/cccd', CCCDController.deleteImage);

export default router;
