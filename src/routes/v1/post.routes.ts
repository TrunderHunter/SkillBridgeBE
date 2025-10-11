import express from 'express';
import { PostController } from '../../controllers/post';
import { handleValidationErrors, authenticateToken, requireRole } from '../../middlewares';
import { UserRole } from '../../types/user.types';
import {
  createPostValidator,
  updatePostValidator,
  reviewPostValidator,
  getPostsValidator,
  tutorSearchValidator
} from '../../validators/post.validator';

const router = express.Router();

// ==================== TUTOR SEARCH APIs (ENHANCED) ====================

// ✅ MAIN API: Universal tutor search with all filters
router.get('/tutors/search', 
  tutorSearchValidator,
  handleValidationErrors,
  PostController.searchTutors
);

// ✅ Get search filter options (for dropdowns)
router.get('/tutors/filters', 
  PostController.getSearchFilterOptions
);

// ✅ NEW: Get featured tutors (homepage, landing page)
router.get('/tutors/featured', 
  PostController.getFeaturedTutors
);

// ✅ NEW: Get tutors by subject (subject detail page)
router.get('/tutors/subject/:subjectId', 
  PostController.getTutorsBySubject
);

// ✅ NEW: Get tutors by location (location browse page)
router.get('/tutors/location', 
  PostController.getTutorsByLocation
);

// ✅ Get tutor detail + increment view count
router.get('/tutors/:tutorId', 
  PostController.getTutorById
);

// ✅ Contact tutor (increment contact count)
router.post('/tutors/:tutorId/contact', 
  authenticateToken, // ✅ FIX: Cần auth để track contact
  PostController.contactTutor
);

// ==================== EXISTING POST APIs ====================

// Tạo bài đăng mới (chỉ sinh viên)
router.post(
  '/',
  authenticateToken,
  requireRole(UserRole.STUDENT), 
  createPostValidator,
  handleValidationErrors,
  PostController.createPost
);

// Lấy danh sách bài đăng (công khai, chỉ bài đã duyệt)
router.get('/', getPostsValidator, handleValidationErrors, PostController.getPosts);

// Admin lấy tất cả bài đăng (có thể filter theo status)
router.get(
  '/all',
  authenticateToken,
  requireRole(UserRole.ADMIN),
  getPostsValidator,
  handleValidationErrors,
  PostController.getAllPostsForAdmin
);

// Lấy danh sách bài đăng của sinh viên đang đăng nhập
router.get(
  '/me',
  authenticateToken,
  requireRole(UserRole.STUDENT),
  PostController.getMyPosts
);

// ✅ MOVE UP: Smart search route (đặt trước generic /:id để tránh conflict)
router.get(
  '/:id/smart-tutors',
  authenticateToken,
  requireRole(UserRole.STUDENT),
  getPostsValidator,
  handleValidationErrors,
  PostController.smartSearchTutors
);

// Lấy chi tiết bài đăng (công khai) - ✅ MOVED DOWN để tránh conflict với smart-tutors
router.get('/:id', PostController.getPostById);

// Cập nhật bài đăng (chỉ sinh viên sở hữu)
router.put(
  '/:id',
  authenticateToken,
  requireRole(UserRole.STUDENT),
  updatePostValidator,
  handleValidationErrors,
  PostController.updatePost
);

// Xóa bài đăng (sinh viên sở hữu hoặc admin)
router.delete(
  '/:id',
  authenticateToken,
  requireRole(UserRole.STUDENT, UserRole.ADMIN),
  PostController.deletePost
);

// Admin duyệt bài đăng
router.patch(
  '/:id/review',
  authenticateToken,
  requireRole(UserRole.ADMIN),
  reviewPostValidator,
  handleValidationErrors,
  PostController.reviewPost
);

export default router;