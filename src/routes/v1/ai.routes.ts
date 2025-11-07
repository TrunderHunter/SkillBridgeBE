import { Router } from 'express';
import { SmartRecommendationController } from '../../controllers/ai/smartRecommendation.controller';
import { aiSurveyController } from '../../controllers/ai/survey.controller';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware';
import { UserRole } from '../../types/user.types';
import { query } from 'express-validator';
import { handleValidationErrors } from '../../middlewares/validation.middleware';
import { surveyValidation } from '../../validators/survey.validator';

const router = Router();

// ==================== PUBLIC AI STATUS ====================

/**
 * GET /api/v1/ai/status
 * Check if AI features are available
 */
router.get('/status', SmartRecommendationController.checkAIStatus);

/**
 * GET /api/v1/ai/posts/:postId/debug-filters
 * Debug endpoint to check filters and matching
 */
router.get(
  '/posts/:postId/debug-filters',
  authenticateToken,
  SmartRecommendationController.debugFilters
);

// ==================== STUDENT SMART RECOMMENDATIONS ====================

/**
 * GET /api/v1/posts/:postId/smart-recommendations
 * Get AI-powered smart tutor recommendations for a student post
 * Requires: Student authentication
 */
router.get(
  '/posts/:postId/smart-recommendations',
  authenticateToken,
  requireRole(UserRole.STUDENT),
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('minScore')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('Min score must be between 0 and 1'),
    query('includeExplanations')
      .optional()
      .isBoolean()
      .withMessage('Include explanations must be boolean'),
  ],
  handleValidationErrors,
  SmartRecommendationController.getSmartRecommendations
);

// ==================== TUTOR PROFILE VECTORIZATION ====================

/**
 * POST /api/v1/tutors/profile/vectorize
 * Trigger vectorization for current tutor's profile
 * Requires: Tutor authentication
 */
router.post(
  '/tutors/profile/vectorize',
  authenticateToken,
  requireRole(UserRole.TUTOR),
  SmartRecommendationController.vectorizeProfile
);

// ==================== ADMIN BATCH OPERATIONS ====================

/**
 * POST /api/v1/admin/tutors/vectorize-all
 * Batch vectorize all verified tutor profiles
 * Requires: Admin authentication
 */
router.post(
  '/admin/tutors/vectorize-all',
  authenticateToken,
  requireRole(UserRole.ADMIN),
  SmartRecommendationController.batchVectorizeProfiles
);

// ==================== AI ONBOARDING SURVEY ====================

/**
 * POST /api/v1/ai/survey
 * Submit AI onboarding survey và nhận recommendations
 * Requires: Student authentication
 */
router.post(
  '/survey',
  authenticateToken,
  requireRole(UserRole.STUDENT),
  surveyValidation.submitSurvey(),
  handleValidationErrors,
  aiSurveyController.submitSurvey
);

/**
 * GET /api/v1/ai/survey
 * Get student's current survey
 * Requires: Student authentication
 */
router.get(
  '/survey',
  authenticateToken,
  requireRole(UserRole.STUDENT),
  aiSurveyController.getSurvey
);

/**
 * GET /api/v1/ai/survey/status
 * Check if student has completed survey
 * Requires: Student authentication
 */
router.get(
  '/survey/status',
  authenticateToken,
  requireRole(UserRole.STUDENT),
  aiSurveyController.getSurveyStatus
);

export default router;
