import { Router } from 'express';
import { ContactRequestController } from '../../controllers/contactRequest/contactRequest.controller';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { requireStudentRole } from '../../middlewares/student.middleware';
import { requireTutorRole } from '../../middlewares/tutor.middleware';
import { validateContactRequest } from '../../validators/contactRequest.validator';
import { handleValidationErrors } from '../../middlewares/validation.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Student routes
router.post(
  '/',
  requireStudentRole,
  validateContactRequest.createRequest,
  handleValidationErrors,
  ContactRequestController.createContactRequest
);

router.get(
  '/student/my-requests',
  requireStudentRole,
  ContactRequestController.getStudentRequests
);

router.put(
  '/:requestId/cancel',
  requireStudentRole,
  ContactRequestController.cancelRequest
);

// Tutor routes
router.get(
  '/tutor/incoming-requests',
  requireTutorRole,
  ContactRequestController.getTutorRequests
);
  
router.put(
  '/:requestId/respond',
  requireTutorRole,
  validateContactRequest.respondToRequest,
  handleValidationErrors,
  ContactRequestController.respondToRequest
);

router.post(
  '/create-class',
  requireTutorRole,
  validateContactRequest.createLearningClass,
  handleValidationErrors,
  ContactRequestController.createLearningClass
);

// Shared routes
router.get(
  '/:requestId',
  ContactRequestController.getRequestDetail
);

export default router;