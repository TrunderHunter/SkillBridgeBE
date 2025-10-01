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
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const result = await tutorPostService.getTutorPosts(tutorId, page, limit);

      return sendSuccess(res, 'Tutor posts retrieved successfully', result);
    } catch (error) {
      logger.error('Get tutor posts error:', error);
      return sendError(res, 'Failed to retrieve tutor posts', undefined, 500);
    }
  }

  // [PUBLIC] Tìm kiếm bài đăng gia sư
  async searchTutorPosts(req: Request, res: Response) {
    try {
      const query: ITutorPostQuery = {
        subjects: req.query.subjects
          ? (req.query.subjects as string).split(',')
          : undefined,
        teachingMode: req.query.teachingMode as any,
        studentLevel: req.query.studentLevel
          ? (req.query.studentLevel as string).split(',')
          : undefined,
        priceMin: req.query.priceMin
          ? parseInt(req.query.priceMin as string)
          : undefined,
        priceMax: req.query.priceMax
          ? parseInt(req.query.priceMax as string)
          : undefined,
        province: req.query.province as string,
        district: req.query.district as string,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
      };

      const result = await tutorPostService.searchTutorPosts(query);

      return sendSuccess(res, 'Search completed successfully', result);
    } catch (error) {
      logger.error('Search tutor posts error:', error);
      return sendError(res, 'Failed to search tutor posts', undefined, 500);
    }
  }

  // [PUBLIC] Lấy chi tiết bài đăng
  async getTutorPostById(req: Request, res: Response) {
    try {
      const { postId } = req.params;

      const tutorPost = await tutorPostService.getTutorPostById(postId);

      if (!tutorPost) {
        return sendError(res, 'Tutor post not found', undefined, 404);
      }

      // Ẩn thông tin nhạy cảm nếu người dùng chưa đăng nhập
      let responseData: any = tutorPost.toObject();

      if (!req.user) {
        // Nếu chưa đăng nhập, ẩn một số thông tin
        if (responseData.tutorId) {
          delete responseData.tutorId.email;
        }
        // Không hiển thị thông tin liên hệ chi tiết
        if (responseData.address) {
          responseData.address = {
            province: responseData.address.province,
            district: responseData.address.district,
            // Ẩn ward và specificAddress
          };
        }
      }

      return sendSuccess(res, 'Tutor post retrieved successfully', {
        tutorPost: responseData,
      });
    } catch (error) {
      logger.error('Get tutor post by ID error:', error);
      return sendError(
        res,
        'Failed to retrieve tutor post',
        error instanceof Error ? error.message : 'Unknown error',
        400
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
