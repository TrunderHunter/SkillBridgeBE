import { Router } from 'express';
import { SessionReportController } from '../../controllers/sessionReport';
import {
  authenticateToken,
  requireAdmin,
} from '../../middlewares/auth.middleware';
import { validateSessionReport } from '../../validators/sessionReport.validator';
import { handleValidationErrors } from '../../middlewares/validation.middleware';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * Admin routes for managing session reports
 */

// Get all session reports (with filters and pagination)
router.get(
  '/session-reports',
  validateSessionReport.getReports,
  handleValidationErrors,
  SessionReportController.getAllReports
);

// Get specific report details
router.get(
  '/session-reports/:reportId',
  validateSessionReport.reportIdParam,
  handleValidationErrors,
  SessionReportController.getReportById
);

// Update report status (e.g., PENDING -> UNDER_REVIEW)
router.put(
  '/session-reports/:reportId/status',
  validateSessionReport.reportIdParam,
  validateSessionReport.updateStatus,
  handleValidationErrors,
  SessionReportController.updateReportStatus
);

// Resolve a report (final decision)
router.put(
  '/session-reports/:reportId/resolve',
  validateSessionReport.reportIdParam,
  validateSessionReport.resolveReport,
  handleValidationErrors,
  SessionReportController.resolveReport
);

// Add admin note to a report
router.post(
  '/session-reports/:reportId/notes',
  validateSessionReport.reportIdParam,
  validateSessionReport.addAdminNote,
  handleValidationErrors,
  SessionReportController.addAdminNote
);

export default router;
