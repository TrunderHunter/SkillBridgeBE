import { Router } from 'express';
import { AdminVerificationController } from '../../controllers/qualification';
import { QualificationValidator } from '../../validators/qualification.validator';
import { handleValidationErrors } from '../../middlewares/validation.middleware';

const router = Router();

/**
 * GET /api/admin/verification-requests - Danh sách yêu cầu xác thực với filter
 */
router.get(
  '/verification-requests',
  QualificationValidator.queryParams(),
  handleValidationErrors,
  AdminVerificationController.getVerificationRequests
);

/**
 * GET /api/admin/verification-requests/:id - Chi tiết một yêu cầu xác thực
 */
router.get(
  '/verification-requests/:id',
  QualificationValidator.mongoIdParam('id'),
  handleValidationErrors,
  AdminVerificationController.getVerificationRequestDetail
);

/**
 * PUT /api/admin/verification-requests/:id - Xử lý yêu cầu (chấp nhận/từ chối từng mục)
 */
router.put(
  '/verification-requests/:id',
  QualificationValidator.processVerificationRequest(),
  handleValidationErrors,
  AdminVerificationController.processVerificationRequest
);

/**
 * GET /api/admin/verification-history - Lịch sử xác thực
 */
router.get(
  '/verification-history',
  QualificationValidator.queryParams(),
  handleValidationErrors,
  AdminVerificationController.getVerificationHistory
);

/**
 * GET /api/admin/verification-stats - Thống kê xác thực
 */
router.get(
  '/verification-stats',
  AdminVerificationController.getVerificationStats
);

export { router as adminVerificationRoutes };
