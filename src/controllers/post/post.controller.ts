import { Request, Response } from 'express';
import { PostService } from '../../services/post';
import { sendSuccess, sendError } from '../../utils/response';
import { IPostInput, IPostUpdateInput, IPostReviewInput } from '../../types/post.types';

export interface CreatePostRequest extends Request {
  body: IPostInput;
}

export interface UpdatePostRequest extends Request {
  body: IPostUpdateInput;
}

export interface ReviewPostRequest extends Request {
  body: IPostReviewInput;
}

export class PostController {
  // Tạo bài đăng mới
  static async createPost(req: CreatePostRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const postData: IPostInput = req.body;

      const result = await PostService.createPost(userId, postData);

      if (result.success) {
        sendSuccess(res, result.message, result.data, 201);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      sendError(res, error.message || 'Lỗi khi tạo bài đăng', undefined, 500);
    }
  }

  // Lấy danh sách bài đăng
  static async getPosts(req: Request, res: Response): Promise<void> {
    try {
      const {
        status,
        subjects,
        grade_levels,
        is_online,
        author_id,
        search_term,
        page,
        limit,
        sort_by,
        sort_order,
      } = req.query;

      // Xử lý các tham số filter
      const filterOptions: any = {};
      if (status) filterOptions.status = status;
      if (subjects) filterOptions.subjects = Array.isArray(subjects) ? subjects : [subjects];
      if (grade_levels) filterOptions.grade_levels = Array.isArray(grade_levels) ? grade_levels : [grade_levels];
      if (is_online !== undefined) filterOptions.is_online = is_online === 'true';
      if (author_id) filterOptions.author_id = author_id;
      if (search_term) filterOptions.search_term = search_term;

      // Xử lý các tham số phân trang
      const paginationOptions: any = {};
      if (page) paginationOptions.page = parseInt(page as string, 10);
      if (limit) paginationOptions.limit = parseInt(limit as string, 10);
      if (sort_by) paginationOptions.sort_by = sort_by;
      if (sort_order) paginationOptions.sort_order = sort_order;

      const result = await PostService.getPosts(filterOptions, paginationOptions);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      sendError(res, error.message || 'Lỗi khi lấy danh sách bài đăng', undefined, 500);
    }
  }

  // Admin: Lấy tất cả bài đăng
  static async getAllPostsForAdmin(req: Request, res: Response): Promise<void> {
    try {
      const {
        status,
        subjects,
        grade_levels,
        is_online,
        author_id,
        search_term,
        page,
        limit,
        sort_by,
        sort_order,
      } = req.query;

      // Xử lý các tham số filter
      const filterOptions: any = {};
      if (status) filterOptions.status = status;
      if (subjects) filterOptions.subjects = Array.isArray(subjects) ? subjects : [subjects];
      if (grade_levels) filterOptions.grade_levels = Array.isArray(grade_levels) ? grade_levels : [grade_levels];
      if (is_online !== undefined) filterOptions.is_online = is_online === 'true';
      if (author_id) filterOptions.author_id = author_id;
      if (search_term) filterOptions.search_term = search_term;

      // Xử lý các tham số phân trang
      const paginationOptions: any = {};
      if (page) paginationOptions.page = parseInt(page as string, 10);
      if (limit) paginationOptions.limit = parseInt(limit as string, 10);
      if (sort_by) paginationOptions.sort_by = sort_by;
      if (sort_order) paginationOptions.sort_order = sort_order;

      const result = await PostService.getPosts(filterOptions, paginationOptions);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      sendError(res, error.message || 'Lỗi khi lấy danh sách bài đăng', undefined, 500);
    }
  }

  // Lấy chi tiết bài đăng
  static async getPostById(req: Request, res: Response): Promise<void> {
    try {
      const postId = req.params.id;

      const result = await PostService.getPostById(postId);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 404);
      }
    } catch (error: any) {
      sendError(res, error.message || 'Lỗi khi lấy chi tiết bài đăng', undefined, 500);
    }
  }

  // Lấy danh sách bài đăng của sinh viên đang đăng nhập
  static async getMyPosts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const result = await PostService.getPosts({ author_id: userId });

      if (result.success) {
        // Chỉ trả về mảng các bài đăng, không cần phân trang cho trang "My Posts"
        sendSuccess(res, result.message, result.data.posts);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      sendError(res, error.message || 'Lỗi khi lấy danh sách bài đăng', undefined, 500);
    }
  }

  // Cập nhật bài đăng
  static async updatePost(req: UpdatePostRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const postId = req.params.id;
      const updateData: IPostUpdateInput = req.body;

      const result = await PostService.updatePost(postId, userId, updateData);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      sendError(res, error.message || 'Lỗi khi cập nhật bài đăng', undefined, 500);
    }
  }

  // Xóa bài đăng
  static async deletePost(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const postId = req.params.id;

      const result = await PostService.deletePost(postId, userId);

      if (result.success) {
        sendSuccess(res, result.message);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      sendError(res, error.message || 'Lỗi khi xóa bài đăng', undefined, 500);
    }
  }

  // Admin duyệt bài đăng
  static async reviewPost(req: ReviewPostRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user!.id;
      const postId = req.params.id;
      const reviewData: IPostReviewInput = req.body;

      const result = await PostService.reviewPost(postId, adminId, reviewData);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      sendError(res, error.message || 'Lỗi khi duyệt bài đăng', undefined, 500);
    }
  }

  // Tìm gia sư thông minh dựa trên bài đăng
  static async smartSearchTutors(req: Request, res: Response): Promise<void> {
    try {
      const studentPostId = req.params.id;
      const {
        page,
        limit,
        sort_by,
        sort_order,
      } = req.query;

      const paginationOptions: any = {};
      if (page) paginationOptions.page = parseInt(page as string, 10);
      if (limit) paginationOptions.limit = parseInt(limit as string, 10);
      if (sort_by) paginationOptions.sort_by = sort_by;
      if (sort_order) paginationOptions.sort_order = sort_order;

      const result = await PostService.smartSearchTutors(studentPostId, paginationOptions);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      sendError(res, error.message || 'Lỗi khi tìm kiếm gia sư thông minh', undefined, 500);
    }
  }
}