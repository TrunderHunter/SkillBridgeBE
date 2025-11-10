import { Router } from 'express';
import { ClassController } from '../../controllers/class/class.controller';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { requireStudentRole } from '../../middlewares/student.middleware';
import {
  requireTutorRole,
  requireApprovedTutorProfile,
} from '../../middlewares/tutor.middleware';
import { validateClass } from '../../validators/class.validator';
import { handleValidationErrors } from '../../middlewares/validation.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Weekly schedule - MUST be before /:classId routes
router.get(
  '/schedule/week',
  ClassController.getWeeklySchedule
);

// Get classes
router.get('/tutor', requireTutorRole, ClassController.getTutorClasses);

router.get('/student', requireStudentRole, ClassController.getStudentClasses);

// Get class schedule with sessions
router.get('/:classId/schedule', ClassController.getClassSchedule);

// Get class details
router.get('/:classId', ClassController.getClassById);

// Update class status (tutor only)
router.patch(
  '/:classId/status',
  requireTutorRole,
  requireApprovedTutorProfile,
  validateClass.updateStatus,
  handleValidationErrors,
  ClassController.updateClassStatus
);

// Update session status (tutor only)
router.patch(
  '/:classId/sessions/:sessionNumber/status',
  requireTutorRole,
  ClassController.updateSessionStatus
);

// Attendance - Both tutor and student can mark attendance
router.post(
  '/:classId/sessions/:sessionNumber/attendance',
  ClassController.markAttendance
);

// Homework management
router.post(
  '/:classId/sessions/:sessionNumber/homework/assign',
  requireTutorRole,
  validateClass.assignHomework,
  handleValidationErrors,
  ClassController.assignHomework
);

router.post(
  '/:classId/sessions/:sessionNumber/homework/submit',
  requireStudentRole,
  validateClass.submitHomework,
  handleValidationErrors,
  ClassController.submitHomework
);

router.post(
  '/:classId/sessions/:sessionNumber/homework/grade',
  requireTutorRole,
  validateClass.gradeHomework,
  handleValidationErrors,
  ClassController.gradeHomework
);

// Request to cancel session (both tutor and student)
router.post(
  '/:classId/sessions/:sessionNumber/cancel/request',
  authenticateToken, // Both roles allowed
  handleValidationErrors,
  ClassController.requestCancelSession
);

// Respond to cancellation request
router.post(
  '/:classId/sessions/:sessionNumber/cancel/respond',
  authenticateToken, // Both roles allowed
  handleValidationErrors,
  ClassController.respondToCancellationRequest
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
  requireApprovedTutorProfile,
  validateClass.addFeedback,
  handleValidationErrors,
  ClassController.addTutorFeedback
);

export default router;
