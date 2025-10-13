import { Router } from 'express';
import { StudentProfileController } from '../../controllers/student/studentProfile.controller';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { requireStudentRole } from '../../middlewares/student.middleware'; // ➕ Thêm import
import { handleValidationErrors } from '../../middlewares/validation.middleware';
import { upload } from '../../config/cloudinary';
import { validateStudentProfile } from '../../validators/studentProfile.validator';

const router = Router();

// All routes require authentication and student role
router.use(authenticateToken);
router.use(requireStudentRole); 

// Get student profile (personal info + student profile)
router.get('/profile', StudentProfileController.getProfile);

// Update personal info (User model fields)
router.put(
  '/profile/personal',
  upload.single('avatar_url'),
  validateStudentProfile.updatePersonalInfo,
  handleValidationErrors,
  StudentProfileController.updatePersonalInfo
);

// Update student preferences
router.put(
  '/profile/preferences',
  validateStudentProfile.updatePreferences,
  handleValidationErrors,
  StudentProfileController.updatePreferences
);

export default router;