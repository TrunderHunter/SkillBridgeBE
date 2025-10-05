import express from 'express';
import { PostController } from '../../controllers/post';
import { handleValidationErrors, authenticateToken, requireRole } from '../../middlewares';
import { UserRole } from '../../types/user.types';
import {
  createPostValidator,
  updatePostValidator,
  reviewPostValidator,
  getPostsValidator,
} from '../../validators/post.validator';

const router = express.Router();

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

// Lấy chi tiết bài đăng (công khai)
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

// Tìm gia sư thông minh cho bài đăng của học viên
router.get(
  '/:id/smart-tutors',
  authenticateToken,
  requireRole(UserRole.STUDENT),
  getPostsValidator,
  handleValidationErrors,
  PostController.smartSearchTutors
);

export default router;