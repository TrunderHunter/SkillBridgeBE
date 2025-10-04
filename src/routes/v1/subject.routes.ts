import { Router } from 'express';
import { subjectController } from '../../controllers/subject';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { requireAdminRole } from '../../middlewares/tutor.middleware';
import { handleValidationErrors } from '../../middlewares/validation.middleware';
import {
  createSubjectValidator,
  updateSubjectValidator,
  subjectIdValidator,
  searchSubjectValidator,
  getSubjectsValidator,
  categoryValidator,
} from '../../validators/subject.validator';

const router = Router();

// Public routes
router.get(
  '/active',
  subjectController.getActiveSubjects.bind(subjectController)
);
router.get(
  '/category/:category',
  categoryValidator,
  handleValidationErrors,
  subjectController.getSubjectsByCategory.bind(subjectController)
);
router.get(
  '/search',
  searchSubjectValidator,
  handleValidationErrors,
  subjectController.searchSubjects.bind(subjectController)
);
router.get(
  '/:id',
  subjectIdValidator,
  handleValidationErrors,
  subjectController.getSubjectById.bind(subjectController)
);

// Admin routes (require authentication and admin role)
router.use(authenticateToken, requireAdminRole);

router.post(
  '/',
  createSubjectValidator,
  handleValidationErrors,
  subjectController.createSubject.bind(subjectController)
);
router.get(
  '/',
  getSubjectsValidator,
  handleValidationErrors,
  subjectController.getAllSubjects.bind(subjectController)
);
router.put(
  '/:id',
  updateSubjectValidator,
  handleValidationErrors,
  subjectController.updateSubject.bind(subjectController)
);
router.delete(
  '/:id',
  subjectIdValidator,
  handleValidationErrors,
  subjectController.deleteSubject.bind(subjectController)
);

export default router;
