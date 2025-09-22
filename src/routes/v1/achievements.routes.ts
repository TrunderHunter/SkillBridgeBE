import { Router } from 'express';
import { AchievementController } from '../../controllers/education';
import { upload } from '../../config/cloudinary';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { handleValidationErrors } from '../../middlewares/validation.middleware';
import {
  createAchievementValidator,
  updateAchievementValidator,
  achievementParamsValidator,
} from '../../validators/achievement.validator';

const router = Router();

// All achievement routes require authentication
router.use(authenticateToken);

// GET /achievements/types - Get available achievement types
router.get('/types', AchievementController.getAchievementTypes);

// GET /achievements/levels - Get available achievement levels
router.get('/levels', AchievementController.getAchievementLevels);

// GET /achievements - Get tutor's achievements
router.get('/', AchievementController.getAchievements);

// GET /achievements/:achievementId - Get achievement by ID
router.get(
  '/:achievementId',
  achievementParamsValidator,
  handleValidationErrors,
  AchievementController.getAchievementById
);

// POST /achievements - Create achievement record
router.post(
  '/',
  upload.single('achievementImage'), // Field name for achievement image upload
  createAchievementValidator,
  handleValidationErrors,
  AchievementController.createAchievement
);

// PUT /achievements/:achievementId - Update achievement record
router.put(
  '/:achievementId',
  upload.single('achievementImage'), // Field name for achievement image upload
  updateAchievementValidator,
  handleValidationErrors,
  AchievementController.updateAchievement
);

// DELETE /achievements/:achievementId - Delete achievement record
router.delete(
  '/:achievementId',
  achievementParamsValidator,
  handleValidationErrors,
  AchievementController.deleteAchievement
);

export default router;
