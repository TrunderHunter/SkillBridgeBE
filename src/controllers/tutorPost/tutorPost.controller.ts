import { Request, Response } from 'express';
import {
  tutorPostService,
  ICreateTutorPostInput,
  IUpdateTutorPostInput,
  ITutorPostQuery,
} from '../../services/tutorPost';
import { sendSuccess, sendError } from '../../utils/response';
import { logger } from '../../utils/logger';

export interface CreateTutorPostRequest extends Request {
  body: ICreateTutorPostInput;
}

export interface UpdateTutorPostRequest extends Request {
  body: IUpdateTutorPostInput;
}

export class TutorPostController {
  // Helper function to handle query array parameters
  private parseArrayParam(param: any): string[] | undefined {
    if (!param) return undefined;

    // If it's already an array, return it
    if (Array.isArray(param)) {
      return param.filter(Boolean); // Remove empty strings
    }

    // If it's a string, split by comma and filter empty values
    if (typeof param === 'string') {
      return param
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return undefined;
  }

  // Helper function to parse number parameter
  private parseNumberParam(param: any): number | undefined {
    if (!param) return undefined;
    const parsed = parseInt(param as string, 10);
    return isNaN(parsed) ? undefined : parsed;
  }

  // [TUTOR] Tạo bài đăng mới
  async createTutorPost(req: CreateTutorPostRequest, res: Response) {
    try {
      const tutorId = req.user!.id;
      const postData = req.body;

      const tutorPost = await tutorPostService.createTutorPost(
        tutorId,
        postData
      );

      logger.info(`Tutor post created: ${tutorPost._id} by tutor ${tutorId}`);

      return sendSuccess(
        res,
        'Tutor post created successfully',
        { tutorPost },
        201
      );
    } catch (error) {
      logger.error('Create tutor post error:', error);

      // Handle schedule conflict error specially
      if (error instanceof Error && (error as any).isScheduleConflict) {
        return sendError(
          res,
          error.message, // Use the Vietnamese error message as the main message
          undefined, // No error field for schedule conflicts
          400
        );
      }

      return sendError(
        res,
        'Failed to create tutor post',
        error instanceof Error ? error.message : 'Unknown error',
        400
      );
    }
  }

  // [TUTOR] Cập nhật bài đăng
  async updateTutorPost(req: UpdateTutorPostRequest, res: Response) {
    try {
      const { postId } = req.params;
      const tutorId = req.user!.id;
      const updateData = req.body;

      const tutorPost = await tutorPostService.updateTutorPost(
        postId,
        tutorId,
        updateData
      );

      if (!tutorPost) {
        return sendError(res, 'Post not found', undefined, 404);
      }

      logger.info(`Tutor post updated: ${postId} by tutor ${tutorId}`);

      return sendSuccess(res, 'Tutor post updated successfully', { tutorPost });
    } catch (error) {
      logger.error('Update tutor post error:', error);

      // Handle schedule conflict error specially
      if (error instanceof Error && (error as any).isScheduleConflict) {
        return sendError(
          res,
          error.message, // Use the Vietnamese error message as the main message
          undefined, // No error field for schedule conflicts
          400
        );
      }

      return sendError(
        res,
        'Failed to update tutor post',
        error instanceof Error ? error.message : 'Unknown error',
        400
      );
    }
  }

  // [TUTOR] Lấy danh sách bài đăng của tutor
  async getMyTutorPosts(req: Request, res: Response) {
    try {
      const tutorId = req.user!.id;
      const page = this.parseNumberParam(req.query.page) || 1;
      const limit = this.parseNumberParam(req.query.limit) || 10;

      const result = await tutorPostService.getTutorPosts(tutorId, page, limit);

      return sendSuccess(res, 'Tutor posts retrieved successfully', result);
    } catch (error) {
      logger.error('Get tutor posts error:', error);
      return sendError(res, 'Failed to retrieve tutor posts', undefined, 500);
    }
  }

  // [TUTOR] Kiểm tra điều kiện đăng bài
  async checkEligibility(req: Request, res: Response) {
    try {
      const tutorId = req.user!.id;

      const eligibilityResult =
        await tutorPostService.checkTutorEligibility(tutorId);

      return sendSuccess(
        res,
        'Eligibility check completed successfully',
        eligibilityResult
      );
    } catch (error) {
      logger.error('Check eligibility error:', error);
      return sendError(
        res,
        'Failed to check eligibility',
        error instanceof Error ? error.message : 'Unknown error',
        500
      );
    }
  }

  // [PUBLIC] Tìm kiếm bài đăng gia sư
  async searchTutorPosts(req: Request, res: Response) {
    try {
      console.log('🔍 TutorPost Controller - Search request:', {
        query: req.query,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const query: ITutorPostQuery = {
        // ✅ Fix: Properly handle array parameters
        subjects: this.parseArrayParam(req.query.subjects),
        teachingMode: req.query.teachingMode as any,
        studentLevel: this.parseArrayParam(req.query.studentLevel),

        // ✅ Fix: Properly handle number parameters
        priceMin: this.parseNumberParam(req.query.priceMin),
        priceMax: this.parseNumberParam(req.query.priceMax),

        // String parameters
        province: req.query.province as string,
        district: req.query.district as string,
        search: req.query.search as string,

        // ✅ Fix: Properly handle pagination parameters
        page: Math.max(1, this.parseNumberParam(req.query.page) || 1),
        limit: Math.min(
          Math.max(1, this.parseNumberParam(req.query.limit) || 12),
          50 // Max limit for performance
        ),

        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
        minRating: this.parseNumberParam(req.query.minRating),
        minReviews: this.parseNumberParam(req.query.minReviews),
      };

      // Log parsed query for debugging
      console.log('📋 Parsed query:', JSON.stringify(query, null, 2));

      const result = await tutorPostService.searchTutorPosts(query);

      logger.info(`Search completed: ${result.posts.length} posts found`, {
        query,
        totalItems: result.pagination.totalItems,
      });

      return sendSuccess(res, 'Search completed successfully', result);
    } catch (error) {
      logger.error('Search tutor posts error:', error);
      return sendError(
        res,
        'Failed to search tutor posts',
        error instanceof Error ? error.message : 'Unknown error',
        500
      );
    }
  }

  // ✅ Get filter options
  async getFilterOptions(req: Request, res: Response) {
    try {
      console.log('🔧 Getting filter options');

      const filterOptions = await tutorPostService.getFilterOptions();

      return sendSuccess(
        res,
        'Filter options retrieved successfully',
        filterOptions
      );
    } catch (error) {
      logger.error('Get filter options error:', error);
      return sendError(
        res,
        'Failed to get filter options',
        error instanceof Error ? error.message : 'Unknown error',
        500
      );
    }
  }

  // ✅ Get districts by province
  async getDistrictsByProvince(req: Request, res: Response) {
    try {
      const { provinceCode } = req.params;

      if (!provinceCode) {
        return sendError(res, 'Province code is required', undefined, 400);
      }

      const districts =
        await tutorPostService.getDistrictsByProvince(provinceCode);

      return sendSuccess(res, 'Districts retrieved successfully', {
        districts,
      });
    } catch (error) {
      logger.error('Get districts error:', error);
      return sendError(
        res,
        'Failed to get districts',
        error instanceof Error ? error.message : 'Unknown error',
        500
      );
    }
  }

  // ✅ Get wards by district
  async getWardsByDistrict(req: Request, res: Response) {
    try {
      const { districtCode } = req.params;

      if (!districtCode) {
        return sendError(res, 'District code is required', undefined, 400);
      }

      const wards = await tutorPostService.getWardsByDistrict(districtCode);

      return sendSuccess(res, 'Wards retrieved successfully', { wards });
    } catch (error) {
      logger.error('Get wards error:', error);
      return sendError(
        res,
        'Failed to get wards',
        error instanceof Error ? error.message : 'Unknown error',
        500
      );
    }
  }

  // ✅ Get tutor post by ID
  async getTutorPostById(req: Request, res: Response) {
    try {
      const { postId } = req.params;
      const userId = req.user?.id;

      // Only increment view count if user is authenticated and not the tutor
      const shouldIncrementView = !!userId;
      const tutorPost = await tutorPostService.getTutorPostById(
        postId,
        shouldIncrementView,
        userId
      );

      if (!tutorPost) {
        return sendError(res, 'Tutor post not found', undefined, 404);
      }

      return sendSuccess(res, 'Tutor post retrieved successfully', {
        tutorPost,
      });
    } catch (error) {
      logger.error('Get tutor post by ID error:', error);
      return sendError(
        res,
        'Failed to get tutor post',
        error instanceof Error ? error.message : 'Unknown error',
        500
      );
    }
  }

  // [TUTOR] Kích hoạt bài đăng
  async activatePost(req: Request, res: Response) {
    try {
      const { postId } = req.params;
      const tutorId = req.user!.id;

      const tutorPost = await tutorPostService.activatePost(postId, tutorId);

      if (!tutorPost) {
        return sendError(res, 'Post not found or unauthorized', undefined, 404);
      }

      logger.info(`Tutor post activated: ${postId} by tutor ${tutorId}`);

      return sendSuccess(res, 'Post activated successfully', { tutorPost });
    } catch (error) {
      logger.error('Activate post error:', error);
      return sendError(
        res,
        'Failed to activate post',
        error instanceof Error ? error.message : 'Unknown error',
        400
      );
    }
  }

  // [TUTOR] Tắt kích hoạt bài đăng
  async deactivatePost(req: Request, res: Response) {
    try {
      const { postId } = req.params;
      const tutorId = req.user!.id;

      const tutorPost = await tutorPostService.deactivatePost(postId, tutorId);

      if (!tutorPost) {
        return sendError(res, 'Post not found or unauthorized', undefined, 404);
      }

      logger.info(`Tutor post deactivated: ${postId} by tutor ${tutorId}`);

      return sendSuccess(res, 'Post deactivated successfully', { tutorPost });
    } catch (error) {
      logger.error('Deactivate post error:', error);
      return sendError(
        res,
        'Failed to deactivate post',
        error instanceof Error ? error.message : 'Unknown error',
        400
      );
    }
  }

  // [TUTOR] Xóa bài đăng
  async deleteTutorPost(req: Request, res: Response) {
    try {
      const { postId } = req.params;
      const tutorId = req.user!.id;

      const deleted = await tutorPostService.deleteTutorPost(postId, tutorId);

      if (!deleted) {
        return sendError(res, 'Post not found or unauthorized', undefined, 404);
      }

      logger.info(`Tutor post deleted: ${postId} by tutor ${tutorId}`);

      return sendSuccess(res, 'Post deleted successfully');
    } catch (error) {
      logger.error('Delete tutor post error:', error);
      return sendError(
        res,
        'Failed to delete post',
        error instanceof Error ? error.message : 'Unknown error',
        400
      );
    }
  }

  // [PUBLIC] Tăng số lượt liên hệ
  async incrementContactCount(req: Request, res: Response) {
    try {
      const { postId } = req.params;

      await tutorPostService.incrementContactCount(postId);

      return sendSuccess(res, 'Contact count updated successfully');
    } catch (error) {
      logger.error('Increment contact count error:', error);
      return sendError(res, 'Failed to update contact count', undefined, 500);
    }
  }
}

export const tutorPostController = new TutorPostController();
