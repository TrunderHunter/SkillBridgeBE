import { Request, Response } from 'express';
import { PostService, ITutorSearchQuery } from '../../services/post';
import { sendSuccess, sendError } from '../../utils/response';
import { validationResult } from 'express-validator';
import {
  IPostInput,
  IPostUpdateInput,
  IPostReviewInput,
} from '../../types/post.types';
import { v4 as uuidv4, validate as validateUUID } from 'uuid';

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
  static async createPost(
    req: CreatePostRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const postData: IPostInput = req.body;

      const result = await PostService.createPost(userId, postData);

      if (result.success) {
        sendSuccess(res, result.message, result.data, 201);
      } else {
        const statusCode = result.isConflict ? 409 : 400;
        sendError(res, result.message, undefined, statusCode);
      }
    } catch (error: any) {
      sendError(res, error.message || 'Lỗi khi tạo bài đăng', undefined, 500);
    }
  }

  // Lấy danh sách bài đăng học viên đã được duyệt (dành cho Gia sư đã xác thực)
  static async getApprovedStudentPostsForTutor(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const {
        subjects,
        grade_levels,
        is_online,
        author_id,
        search_term,
        min_hourly_rate,
        max_hourly_rate,
        page,
        limit,
        sort_by,
        sort_order,
      } = req.query;

      const filterOptions: any = {};
      if (subjects)
        filterOptions.subjects = Array.isArray(subjects)
          ? subjects
          : [subjects];
      if (grade_levels)
        filterOptions.grade_levels = Array.isArray(grade_levels)
          ? grade_levels
          : [grade_levels];
      if (is_online !== undefined)
        filterOptions.is_online = is_online === 'true';
      if (author_id) filterOptions.author_id = author_id;
      if (search_term) filterOptions.search_term = search_term;
      if (min_hourly_rate && !isNaN(Number(min_hourly_rate))) {
        filterOptions.min_hourly_rate = parseFloat(min_hourly_rate as string);
      }
      if (max_hourly_rate && !isNaN(Number(max_hourly_rate))) {
        filterOptions.max_hourly_rate = parseFloat(max_hourly_rate as string);
      }

      const paginationOptions: any = {};
      if (page) paginationOptions.page = parseInt(page as string, 10);
      if (limit) paginationOptions.limit = parseInt(limit as string, 10);
      if (sort_by) paginationOptions.sort_by = sort_by;
      if (sort_order) paginationOptions.sort_order = sort_order;

      const result = await PostService.getApprovedStudentPostsForTutor(
        filterOptions,
        paginationOptions
      );

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      sendError(
        res,
        error.message || 'Lỗi khi lấy bài đăng đã duyệt cho gia sư',
        undefined,
        500
      );
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
      if (subjects)
        filterOptions.subjects = Array.isArray(subjects)
          ? subjects
          : [subjects];
      if (grade_levels)
        filterOptions.grade_levels = Array.isArray(grade_levels)
          ? grade_levels
          : [grade_levels];
      if (is_online !== undefined)
        filterOptions.is_online = is_online === 'true';
      if (author_id) filterOptions.author_id = author_id;
      if (search_term) filterOptions.search_term = search_term;

      // Xử lý các tham số phân trang
      const paginationOptions: any = {};
      if (page) paginationOptions.page = parseInt(page as string, 10);
      if (limit) paginationOptions.limit = parseInt(limit as string, 10);
      if (sort_by) paginationOptions.sort_by = sort_by;
      if (sort_order) paginationOptions.sort_order = sort_order;

      const result = await PostService.getPosts(
        filterOptions,
        paginationOptions
      );

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      sendError(
        res,
        error.message || 'Lỗi khi lấy danh sách bài đăng',
        undefined,
        500
      );
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
      if (subjects)
        filterOptions.subjects = Array.isArray(subjects)
          ? subjects
          : [subjects];
      if (grade_levels)
        filterOptions.grade_levels = Array.isArray(grade_levels)
          ? grade_levels
          : [grade_levels];
      if (is_online !== undefined)
        filterOptions.is_online = is_online === 'true';
      if (author_id) filterOptions.author_id = author_id;
      if (search_term) filterOptions.search_term = search_term;

      // Xử lý các tham số phân trang
      const paginationOptions: any = {};
      if (page) paginationOptions.page = parseInt(page as string, 10);
      if (limit) paginationOptions.limit = parseInt(limit as string, 10);
      if (sort_by) paginationOptions.sort_by = sort_by;
      if (sort_order) paginationOptions.sort_order = sort_order;

      const result = await PostService.getPosts(
        filterOptions,
        paginationOptions
      );

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      sendError(
        res,
        error.message || 'Lỗi khi lấy danh sách bài đăng',
        undefined,
        500
      );
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
      sendError(
        res,
        error.message || 'Lỗi khi lấy chi tiết bài đăng',
        undefined,
        500
      );
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
      sendError(
        res,
        error.message || 'Lỗi khi lấy danh sách bài đăng',
        undefined,
        500
      );
    }
  }

  // Cập nhật bài đăng
  static async updatePost(
    req: UpdatePostRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const postId = req.params.id;
      const updateData: IPostUpdateInput = req.body;

      const result = await PostService.updatePost(postId, userId, updateData);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        const statusCode = result.isConflict ? 409 : 400;
        sendError(res, result.message, undefined, statusCode);
      }
    } catch (error: any) {
      sendError(
        res,
        error.message || 'Lỗi khi cập nhật bài đăng',
        undefined,
        500
      );
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
  static async reviewPost(
    req: ReviewPostRequest,
    res: Response
  ): Promise<void> {
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

  // Smart Search với đầy đủ filters
  static async smartSearchTutors(req: Request, res: Response): Promise<void> {
    try {
      const studentPostId = req.params.id;

      if (!studentPostId) {
        console.error('❌ Missing postId in request params');
        return sendError(res, 'ID bài đăng là bắt buộc', undefined, 400);
      }

      const trimmedPostId = studentPostId.trim();
      if (!trimmedPostId) {
        console.error('❌ PostId is empty after trim');
        return sendError(res, 'ID bài đăng không được rỗng', undefined, 400);
      }

      const isValidUUID = validateUUID(trimmedPostId);
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(trimmedPostId);

      if (!isValidUUID && !isValidObjectId) {
        console.error('❌ Invalid Post ID format:', {
          postId: trimmedPostId,
          length: trimmedPostId.length,
          isUUID: isValidUUID,
          isObjectId: isValidObjectId,
        });
        return sendError(
          res,
          'ID bài đăng phải là UUID hoặc MongoDB ObjectId hợp lệ',
          undefined,
          400
        );
      }

      const {
        subjects,
        teachingMode,
        studentLevel,
        priceMin,
        priceMax,
        province,
        district,
        ward,
        search,
        page,
        limit,
        sort_by,
        sort_order,
      } = req.query;

      const searchQuery: ITutorSearchQuery = {};

      if (subjects) {
        searchQuery.subjects = Array.isArray(subjects)
          ? (subjects as string[])
          : ([subjects] as string[]);
      }

      if (studentLevel) {
        searchQuery.studentLevel = Array.isArray(studentLevel)
          ? (studentLevel as string[])
          : ([studentLevel] as string[]);
      }

      if (
        teachingMode &&
        ['ONLINE', 'OFFLINE', 'BOTH'].includes(teachingMode as string)
      ) {
        searchQuery.teachingMode = teachingMode as any;
      }

      if (priceMin && !isNaN(Number(priceMin))) {
        searchQuery.priceMin = parseInt(priceMin as string, 10);
      }

      if (priceMax && !isNaN(Number(priceMax))) {
        searchQuery.priceMax = parseInt(priceMax as string, 10);
      }

      if (province) {
        searchQuery.province = province as string;
      }

      if (district) {
        searchQuery.district = district as string;
      }

      if (ward) {
        searchQuery.ward = ward as string;
      }

      if (search && typeof search === 'string' && search.trim()) {
        searchQuery.search = search.trim();
      }

      const paginationOptions: any = {
        page:
          page && !isNaN(Number(page))
            ? Math.max(1, parseInt(page as string, 10))
            : 1,
        limit:
          limit && !isNaN(Number(limit))
            ? Math.min(50, Math.max(1, parseInt(limit as string, 10)))
            : 12,
        sort_by:
          sort_by &&
          [
            'compatibility',
            'createdAt',
            'pricePerSession',
            'viewCount',
          ].includes(sort_by as string)
            ? (sort_by as string)
            : 'compatibility',
        sort_order:
          sort_order && ['asc', 'desc'].includes(sort_order as string)
            ? (sort_order as string)
            : 'desc',
      };

      const result = await PostService.smartSearchTutorsWithFilters(
        trimmedPostId,
        searchQuery,
        paginationOptions
      );
      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      console.error('❌ Smart Search Controller Error:', {
        message: error.message,
        stack: error.stack,
        postId: req.params.id,
      });
      sendError(
        res,
        error.message || 'Lỗi server khi tìm kiếm gia sư thông minh',
        undefined,
        500
      );
    }
  }

  // Search Tutors for Students (Regular Search)
  static async searchTutors(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendError(res, 'Dữ liệu không hợp lệ', undefined, 400);
      }

      const {
        subjects,
        teachingMode,
        studentLevel,
        priceMin,
        priceMax,
        province,
        district,
        ward,
        search,
        page,
        limit,
        sortBy,
        sortOrder,
      } = req.query;

      const searchQuery: ITutorSearchQuery = {};

      if (subjects) {
        searchQuery.subjects = Array.isArray(subjects)
          ? (subjects as string[])
          : ([subjects] as string[]);
      }

      if (studentLevel) {
        searchQuery.studentLevel = Array.isArray(studentLevel)
          ? (studentLevel as string[])
          : ([studentLevel] as string[]);
      }

      if (teachingMode) searchQuery.teachingMode = teachingMode as any;
      if (priceMin) searchQuery.priceMin = parseInt(priceMin as string, 10);
      if (priceMax) searchQuery.priceMax = parseInt(priceMax as string, 10);
      if (province) searchQuery.province = province as string;
      if (district) searchQuery.district = district as string;
      if (ward) searchQuery.ward = ward as string;
      if (search) searchQuery.search = search as string;
      if (page) searchQuery.page = parseInt(page as string, 10);
      if (limit) searchQuery.limit = parseInt(limit as string, 10);
      if (sortBy) searchQuery.sortBy = sortBy as any;
      if (sortOrder) searchQuery.sortOrder = sortOrder as any;

      const result = await PostService.searchTutors(searchQuery);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, result.error, 400);
      }
    } catch (error: any) {
      console.error('❌ Search tutors controller error:', error);
      sendError(
        res,
        error.message || 'Lỗi khi tìm kiếm gia sư',
        undefined,
        500
      );
    }
  }

  // Get Featured Tutors
  static async getFeaturedTutors(req: Request, res: Response): Promise<void> {
    try {
      const { limit } = req.query;
      const limitNum = limit ? parseInt(limit as string, 10) : 8;
      const result = await PostService.getFeaturedTutors(limitNum);
      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      console.error('❌ Get featured tutors controller error:', error);
      sendError(
        res,
        error.message || 'Lỗi khi lấy gia sư nổi bật',
        undefined,
        500
      );
    }
  }

  // Get Tutors by Subject
  static async getTutorsBySubject(req: Request, res: Response): Promise<void> {
    try {
      const { subjectId } = req.params;
      const { page, limit } = req.query;
      if (!subjectId) {
        return sendError(res, 'Subject ID is required', undefined, 400);
      }
      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 12;
      const result = await PostService.getTutorsBySubject(
        subjectId,
        pageNum,
        limitNum
      );
      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      console.error('❌ Get tutors by subject controller error:', error);
      sendError(
        res,
        error.message || 'Lỗi khi lấy gia sư theo môn học',
        undefined,
        500
      );
    }
  }

  // Get Tutors by Location
  static async getTutorsByLocation(req: Request, res: Response): Promise<void> {
    try {
      const { province, district, page, limit } = req.query;
      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 12;
      const result = await PostService.getTutorsByLocation(
        province as string,
        district as string,
        pageNum,
        limitNum
      );
      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      console.error('❌ Get tutors by location controller error:', error);
      sendError(
        res,
        error.message || 'Lỗi khi lấy gia sư theo khu vực',
        undefined,
        500
      );
    }
  }

  // Get Tutor Detail
  static async getTutorById(req: Request, res: Response): Promise<void> {
    try {
      const { tutorId } = req.params;
      if (!tutorId) {
        return sendError(res, 'Tutor ID is required', undefined, 400);
      }
      const result = await PostService.getTutorById(tutorId);
      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(
          res,
          result.message,
          undefined,
          result.message.includes('Không tìm thấy') ? 404 : 400
        );
      }
    } catch (error: any) {
      console.error('❌ Get tutor by ID controller error:', error);
      sendError(
        res,
        error.message || 'Lỗi khi lấy chi tiết gia sư',
        undefined,
        500
      );
    }
  }

  // Contact Tutor
  static async contactTutor(req: Request, res: Response): Promise<void> {
    try {
      const { tutorId } = req.params;
      if (!tutorId) {
        return sendError(res, 'Tutor ID is required', undefined, 400);
      }
      const result = await PostService.contactTutor(tutorId);
      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      console.error('❌ Contact tutor controller error:', error);
      sendError(res, error.message || 'Lỗi khi liên hệ gia sư', undefined, 500);
    }
  }

  // Get Search Filter Options
  static async getSearchFilterOptions(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const result = await PostService.getSearchFilterOptions();
      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      console.error('❌ Get search filter options controller error:', error);
      sendError(
        res,
        error.message || 'Lỗi khi lấy tùy chọn bộ lọc',
        undefined,
        500
      );
    }
  }
}
