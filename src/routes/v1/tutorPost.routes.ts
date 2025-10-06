import { Router } from 'express';
import { tutorPostController } from '../../controllers/tutorPost';
import {
  authenticateToken,
  optionalAuth,
} from '../../middlewares/auth.middleware';
import {
  requireTutorQualification,
  requirePostOwnership,
} from '../../middlewares/tutor.middleware';
import { handleValidationErrors } from '../../middlewares/validation.middleware';
import {
  createTutorPostValidator,
  updateTutorPostValidator,
  postIdValidator,
  searchTutorPostsValidator,
  paginationValidator,
} from '../../validators/tutorPost.validator';

const router = Router();

// Public routes
router.get(
  '/search',
  searchTutorPostsValidator,
  handleValidationErrors,
  tutorPostController.searchTutorPosts.bind(tutorPostController)
);
router.get(
  '/:postId',
  optionalAuth,
  postIdValidator,
  handleValidationErrors,
  tutorPostController.getTutorPostById.bind(tutorPostController)
);
router.post(
  '/:postId/contact',
  postIdValidator,
  handleValidationErrors,
  tutorPostController.incrementContactCount.bind(tutorPostController)
);

// Protected routes (require authentication)
router.use(authenticateToken);

// Tutor routes (require tutor qualification)
router.post(
  '/',
  requireTutorQualification,
  createTutorPostValidator,
  handleValidationErrors,
  tutorPostController.createTutorPost.bind(tutorPostController)
);
router.get(
  '/',
  paginationValidator,
  handleValidationErrors,
  tutorPostController.getMyTutorPosts.bind(tutorPostController)
);
router.get(
  '/eligibility/check',
  tutorPostController.checkEligibility.bind(tutorPostController)
);

// Tutor post management routes (require ownership)
router.put(
  '/:postId',
  requirePostOwnership,
  updateTutorPostValidator,
  handleValidationErrors,
  tutorPostController.updateTutorPost.bind(tutorPostController)
);
router.post(
  '/:postId/activate',
  requirePostOwnership,
  postIdValidator,
  handleValidationErrors,
  tutorPostController.activatePost.bind(tutorPostController)
);
router.post(
  '/:postId/deactivate',
  requirePostOwnership,
  postIdValidator,
  handleValidationErrors,
  tutorPostController.deactivatePost.bind(tutorPostController)
);
router.delete(
  '/:postId',
  requirePostOwnership,
  postIdValidator,
  handleValidationErrors,
  tutorPostController.deleteTutorPost.bind(tutorPostController)
);

export default router;
