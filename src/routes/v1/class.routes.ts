import { Router } from 'express';
import { ClassController } from '../../controllers/class/class.controller';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { requireStudentRole } from '../../middlewares/student.middleware';
import { requireTutorRole } from '../../middlewares/tutor.middleware';
import { validateClass } from '../../validators/class.validator';
import { handleValidationErrors } from '../../middlewares/validation.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get classes
router.get(
  '/tutor',
  requireTutorRole,
  ClassController.getTutorClasses
);

router.get(
  '/student',
  requireStudentRole,
  ClassController.getStudentClasses
);

// Get class details
router.get(
  '/:classId',
  ClassController.getClassById
);

// Update class status (tutor only)
router.patch(
  '/:classId/status',
  requireTutorRole,
  validateClass.updateStatus,
  handleValidationErrors,
  ClassController.updateClassStatus
);

// Add reviews
router.post(
  '/:classId/student-review',
  requireStudentRole,
  validateClass.addReview,
  handleValidationErrors,
  ClassController.addStudentReview
);

router.post(
  '/:classId/tutor-feedback',
  requireTutorRole,
  validateClass.addFeedback,
  handleValidationErrors,
  ClassController.addTutorFeedback
);

export default router;