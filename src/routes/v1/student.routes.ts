import { Router } from 'express';
import { StudentController } from '../../controllers/student/student.controller';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware';
import { handleValidationErrors } from '../../middlewares/validation.middleware';
import { 
  createStudentProfileValidation,
  updateStudentProfileValidation,
  studentIdValidation
} from '../../validators/student.validator';

const router = Router();

// ===========================================
// MIDDLEWARE: Tất cả routes đều yêu cầu authentication
// ===========================================
router.use(authenticateToken);

// ===========================================
// STUDENT PROFILE ROUTES - THỨ TỰ ĐỘ ƯU TIÊN
// ===========================================

/**
 * @route   GET /api/v1/students/profiles/stats
 * @desc    Lấy thống kê hồ sơ học viên của phụ huynh
 * @access  Private (PARENT only)
 * @note    PHẢI ĐẶT TRƯỚC /profiles và /profiles/:studentId
 */
router.get(
  '/profiles/stats', 
  requireRole('PARENT'),
  StudentController.getStudentStats
);

/**
 * @route   POST /api/v1/students/profiles
 * @desc    Tạo hồ sơ học viên mới (chỉ PARENT được phép)
 * @access  Private (PARENT only)
 */
router.post(
  '/profiles',
  requireRole('PARENT'),
  createStudentProfileValidation,
  handleValidationErrors,
  StudentController.createStudentProfile
);

/**
 * @route   GET /api/v1/students/profiles
 * @desc    Lấy danh sách hồ sơ học viên của phụ huynh
 * @access  Private (PARENT only)
 */
router.get(
  '/profiles', 
  requireRole('PARENT'),
  StudentController.getStudentProfiles
);

/**
 * @route   GET /api/v1/students/profiles/:studentId
 * @desc    Lấy chi tiết hồ sơ học viên
 * @access  Private (PARENT only - chỉ được xem con của mình)
 * @note    ĐẶT SAU các route cụ thể như /stats
 */
router.get(
  '/profiles/:studentId',
  requireRole('PARENT'),
  studentIdValidation,
  handleValidationErrors,
  StudentController.getStudentProfile
);

/**
 * @route   PUT /api/v1/students/profiles/:studentId
 * @desc    Cập nhật hồ sơ học viên
 * @access  Private (PARENT only - chỉ được sửa con của mình)
 */
router.put(
  '/profiles/:studentId',
  requireRole('PARENT'),
  studentIdValidation,
  updateStudentProfileValidation,
  handleValidationErrors,
  StudentController.updateStudentProfile
);

/**
 * @route   DELETE /api/v1/students/profiles/:studentId
 * @desc    Xóa hồ sơ học viên (soft delete)
 * @access  Private (PARENT only - chỉ được xóa con của mình)
 */
router.delete(
  '/profiles/:studentId',
  requireRole('PARENT'),
  studentIdValidation,
  handleValidationErrors,
  StudentController.deleteStudentProfile
);

/**
 * @route   POST /api/v1/students/profiles/:studentId/reset-password
 * @desc    Tạo lại mật khẩu tạm thời cho học viên
 * @access  Private (PARENT only)
 */
router.post(
  '/profiles/:studentId/reset-password',
  requireRole('PARENT'),
  studentIdValidation,
  handleValidationErrors,
  StudentController.resendStudentPassword
);

export default router;