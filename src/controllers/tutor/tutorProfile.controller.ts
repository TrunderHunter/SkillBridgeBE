import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../utils/response';
import { tutorService, cccdService } from '../../services/tutor';
import { logger } from '../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export class TutorProfileController {
  // Get tutor profile (personal info + tutor profile)
  static async getProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Người dùng chưa được xác thực', undefined, 401);
      }

      logger.info(`Getting profile for user: ${userId}`);

      const result = await tutorService.getProfile(userId);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 404);
      }
    } catch (error) {
      logger.error('Get profile controller error:', error);
      sendError(
        res,
        'Lấy thông tin hồ sơ thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }

  // Update personal info (User model)
  static async updatePersonalInfo(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Người dùng chưa được xác thực', undefined, 401);
      }

      logger.info(`Updating personal info for user: ${userId}`);

      const personalInfoData = {
        full_name: req.body.full_name,
        phone_number: req.body.phone_number,
        gender: req.body.gender,
        date_of_birth: req.body.date_of_birth,
        address: req.body.address,
      };

      // Handle avatar file if present
      const avatarFile =
        req.file && req.file.fieldname === 'avatar_url' ? req.file : undefined;

      const result = await tutorService.updatePersonalInfo(
        userId,
        personalInfoData,
        avatarFile
      );

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error) {
      logger.error('Update personal info controller error:', error);
      sendError(
        res,
        'Cập nhật thông tin cá nhân thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }

  // Update tutor profile introduction
  static async updateIntroduction(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Người dùng chưa được xác thực', undefined, 401);
      }

      logger.info(`Updating introduction for user: ${userId}`);

      const tutorProfileData = {
        headline: req.body.headline,
        introduction: req.body.introduction,
        teaching_experience: req.body.teaching_experience,
        student_levels: req.body.student_levels,
        video_intro_link: req.body.video_intro_link,
      };

      const result = await tutorService.updateIntroduction(
        userId,
        tutorProfileData
      );

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error) {
      logger.error('Update introduction controller error:', error);
      sendError(
        res,
        'Cập nhật thông tin giới thiệu thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }

  // Upload CCCD images
  static async uploadCCCDImages(
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
  static async deleteCCCDImage(
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
        sendError(
          res,
          result.message,
          undefined,
          result.message.includes('Không tìm thấy') ? 404 : 400
        );
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
}
