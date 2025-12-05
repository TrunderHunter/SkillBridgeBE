import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import {
  requireTutorRole,
  requireApprovedTutorProfile,
} from '../../middlewares/tutor.middleware';
import { ExerciseTemplateController } from '../../controllers/assignment/exerciseTemplate.controller';
import { RubricController } from '../../controllers/assignment/rubric.controller';

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

// Rubrics
router.get('/rubrics', RubricController.listRubrics);
router.get('/rubrics/:rubricId', RubricController.getRubric);
router.post('/rubrics', RubricController.createRubric);
router.put('/rubrics/:rubricId', RubricController.updateRubric);
router.delete('/rubrics/:rubricId', RubricController.deleteRubric);

export default router;


