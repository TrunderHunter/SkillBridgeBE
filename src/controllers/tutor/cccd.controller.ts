import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../utils/response';
import { cccdService } from '../../services/tutor';
import { logger } from '../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export class CCCDController {
  // Upload CCCD images
  static async uploadImages(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Người dùng chưa được xác thực', undefined, 401);
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return sendError(
          res,
          'Không có ảnh CCCD nào được cung cấp',
          undefined,
          400
        );
      }

      logger.info(`Uploading CCCD images for user: ${userId}`);

      const files = req.files as Express.Multer.File[];
      const result = await cccdService.uploadImages(userId, files);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error) {
      logger.error('Upload CCCD images controller error:', error);
      sendError(
        res,
        'Tải ảnh CCCD thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }

  // Delete CCCD image
  static async deleteImage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      const { imageUrl } = req.body;

      if (!userId) {
        return sendError(res, 'Người dùng chưa được xác thực', undefined, 401);
      }

      if (!imageUrl) {
        return sendError(res, 'URL ảnh là bắt buộc', undefined, 400);
      }

      logger.info(`Deleting CCCD image for user: ${userId}`);

      const result = await cccdService.deleteImage(userId, imageUrl);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        const statusCode = result.message.includes('Không tìm thấy')
          ? 404
          : 400;
        sendError(res, result.message, undefined, statusCode);
      }
    } catch (error) {
      logger.error('Delete CCCD image controller error:', error);
      sendError(
        res,
        'Xóa ảnh CCCD thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }

  // Get CCCD images
  static async getImages(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Người dùng chưa được xác thực', undefined, 401);
      }

      logger.info(`Getting CCCD images for user: ${userId}`);

      const result = await cccdService.getImages(userId);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 500);
      }
    } catch (error) {
      logger.error('Get CCCD images controller error:', error);
      sendError(
        res,
        'Lấy danh sách ảnh CCCD thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }
}
