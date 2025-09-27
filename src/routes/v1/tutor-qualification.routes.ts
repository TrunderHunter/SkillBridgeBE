import { Router } from 'express';
import { TutorQualificationController } from '../../controllers/qualification';
import { QualificationValidator } from '../../validators/qualification.validator';
import { handleValidationErrors } from '../../middlewares/validation.middleware';
import { upload } from '../../config/cloudinary';

const router = Router();

/**
 * GET /api/tutor/qualifications - Lấy toàn bộ thông tin trình độ
 */
router.get('/qualifications', TutorQualificationController.getQualifications);

/**
 * Education routes - HỖ TRỢ UPLOAD ẢNH
 */
router.post(
  '/education',
  upload.single('image'), // Thêm multer middleware
  QualificationValidator.education(),
  handleValidationErrors,
  TutorQualificationController.createEducation
);

router.put(
  '/education',
  upload.single('image'), // Thêm multer middleware
  QualificationValidator.education(),
  handleValidationErrors,
  TutorQualificationController.updateEducation
);

/**
 * Certificate routes - HỖ TRỢ UPLOAD ẢNH
 */
router.post(
  '/certificates',
  upload.single('image'), // Thêm multer middleware
  QualificationValidator.certificate(),
  handleValidationErrors,
  TutorQualificationController.createCertificate
);

router.put(
  '/certificates/:id',
  QualificationValidator.mongoIdParam('id'),
  upload.single('image'), // Thêm multer middleware
  QualificationValidator.certificate(),
  handleValidationErrors,
  TutorQualificationController.updateCertificate
);

router.delete(
  '/certificates/:id',
  QualificationValidator.mongoIdParam('id'),
  handleValidationErrors,
  TutorQualificationController.deleteCertificate
);

/**
 * Achievement routes - HỖ TRỢ UPLOAD ẢNH
 */
router.post(
  '/achievements',
  upload.single('image'), // Thêm multer middleware
  QualificationValidator.achievement(),
  handleValidationErrors,
  TutorQualificationController.createAchievement
);

router.put(
  '/achievements/:id',
  QualificationValidator.mongoIdParam('id'),
  upload.single('image'), // Thêm multer middleware
  QualificationValidator.achievement(),
  handleValidationErrors,
  TutorQualificationController.updateAchievement
);

router.delete(
  '/achievements/:id',
  QualificationValidator.mongoIdParam('id'),
  handleValidationErrors,
  TutorQualificationController.deleteAchievement
);

/**
 * Verification request routes
 */
router.post(
  '/verification-requests',
  QualificationValidator.verificationRequest(),
  handleValidationErrors,
  TutorQualificationController.createVerificationRequest
);

router.get(
  '/verification-requests',
  QualificationValidator.queryParams(),
  handleValidationErrors,
  TutorQualificationController.getVerificationRequests
);

export { router as tutorQualificationRoutes };
