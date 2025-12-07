import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import {
  requireTutorRole,
  requireApprovedTutorProfile,
} from '../../middlewares/tutor.middleware';
import { ExerciseTemplateController } from '../../controllers/assignment/exerciseTemplate.controller';

const router = Router();

// All routes require authenticated tutor
router.use(authenticateToken, requireTutorRole, requireApprovedTutorProfile);

// Exercise templates
router.get('/templates', ExerciseTemplateController.listTemplates);
router.get('/templates/:templateId', ExerciseTemplateController.getTemplate);
router.post('/templates', ExerciseTemplateController.createTemplate);
router.put('/templates/:templateId', ExerciseTemplateController.updateTemplate);
router.delete(
  '/templates/:templateId',
  ExerciseTemplateController.deleteTemplate
);

export default router;


