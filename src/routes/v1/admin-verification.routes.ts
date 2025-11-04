import { Router } from 'express';
import { AdminVerificationController } from '../../controllers/qualification';
import { TutorProfileController } from '../../controllers/tutor';
import { QualificationValidator } from '../../validators/qualification.validator';
import { handleValidationErrors } from '../../middlewares/validation.middleware';
import {
  authenticateToken,
  requireAdmin,
} from '../../middlewares/auth.middleware';

const router = Router();

/**
 * GET /api/admin/verification-requests - Danh sách yêu cầu xác thực với filter
 */
router.get(
  '/verification-requests',
  authenticateToken,
  requireAdmin,
  QualificationValidator.queryParams(),
  handleValidationErrors,
  AdminVerificationController.getVerificationRequests
);

/**
 * GET /api/admin/verification-requests/:id - Chi tiết một yêu cầu xác thực
 */
router.get(
  '/verification-requests/:id',
  authenticateToken,
  requireAdmin,
  QualificationValidator.uuidParam('id'),
  handleValidationErrors,
  AdminVerificationController.getVerificationRequestDetail
);

/**
 * GET /api/admin/verification-requests/:tutorId/user-info - Lấy thông tin User và TutorProfile
 */
router.get(
  '/verification-requests/:tutorId/user-info',
  authenticateToken,
  requireAdmin,
  QualificationValidator.uuidParam('tutorId'),
  handleValidationErrors,
  AdminVerificationController.getUserAndTutorProfileInfo
);

/**
 * PUT /api/admin/verification-requests/:id - Xử lý yêu cầu (chấp nhận/từ chối từng mục)
 */
router.put(
  '/verification-requests/:id',
  authenticateToken,
  requireAdmin,
  QualificationValidator.uuidParam('id'),
  QualificationValidator.processVerificationRequest(),
  handleValidationErrors,
  AdminVerificationController.processVerificationRequest
);

/**
 * GET /api/admin/verification-history - Lịch sử xác thực
 */
router.get(
  '/verification-history',
  authenticateToken,
  requireAdmin,
  QualificationValidator.queryParams(),
  handleValidationErrors,
  AdminVerificationController.getVerificationHistory
);

/**
 * GET /api/admin/verification-stats - Thống kê xác thực
 */
router.get(
  '/verification-stats',
  authenticateToken,
  requireAdmin,
  AdminVerificationController.getVerificationStats
);

// ==================== NEW: TUTOR PROFILE VERIFICATION ROUTES ====================

/**
 * GET /api/admin/tutor-profiles/pending - Get all pending tutor profile verifications
 */
router.get(
  '/tutor-profiles/pending',
  authenticateToken,
  requireAdmin,
  TutorProfileController.getPendingVerifications
);

/**
 * POST /api/admin/tutor-profiles/:profileId/approve - Approve tutor profile
 */
router.post(
  '/tutor-profiles/:profileId/approve',
  authenticateToken,
  requireAdmin,
  TutorProfileController.approveProfile
);

/**
 * POST /api/admin/tutor-profiles/:profileId/reject - Reject tutor profile
 */
router.post(
  '/tutor-profiles/:profileId/reject',
  authenticateToken,
  requireAdmin,
  TutorProfileController.rejectProfile
);

export { router as adminVerificationRoutes };
