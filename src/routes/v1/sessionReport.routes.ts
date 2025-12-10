import { Router } from 'express';
import { SessionReportController } from '../../controllers/sessionReport';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { validateSessionReport } from '../../validators/sessionReport.validator';
import { handleValidationErrors } from '../../middlewares/validation.middleware';
import { uploadAny } from '../../config/cloudinary';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * User routes (Student & Tutor)
 * Both students and tutors can create and view their own reports
 */

// Create a new session report with evidence files
router.post(
  '/',
  uploadAny.array('evidence', 5), // Allow up to 5 evidence files
  validateSessionReport.createReport,
  handleValidationErrors,
  SessionReportController.createReport
);

// Get my reports (with filters)
router.get(
  '/',
  validateSessionReport.getReports,
  handleValidationErrors,
  SessionReportController.getMyReports
);

// Get specific report details
router.get(
  '/:reportId',
  validateSessionReport.reportIdParam,
  handleValidationErrors,
  SessionReportController.getReportById
);

// Upload additional evidence to an existing report
router.post(
  '/:reportId/evidence',
  uploadAny.array('evidence', 5),
  validateSessionReport.reportIdParam,
  handleValidationErrors,
  SessionReportController.uploadAdditionalEvidence
);

export default router;
