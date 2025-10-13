import { Request, Response, NextFunction } from 'express';
import { studentService } from '../../services/student/student.service';
import { sendSuccess, sendError } from '../../utils/response';
import { logger } from '../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export class StudentProfileController {
  // Get student profile (personal info + student profile)
  static async getProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Không tìm thấy thông tin xác thực', undefined, 401);
      }

      logger.info(`Getting student profile for user: ${userId}`);

      const result = await studentService.getProfile(userId);

      if (result.success) {
        return sendSuccess(res, result.message, result.data);
      } else {
        return sendError(res, result.message, undefined, 400);
      }
    } catch (error) {
      logger.error('Get student profile controller error:', error);
      return sendError(
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
        return sendError(res, 'Không tìm thấy thông tin xác thực', undefined, 401);
      }

      const personalInfo = req.body;
      const avatarFile = req.file;

      logger.info(`Updating student personal info for user: ${userId}`);

      const result = await studentService.updatePersonalInfo(
        userId,
        personalInfo,
        avatarFile
      );

      if (result.success) {
        return sendSuccess(res, result.message, result.data);
      } else {
        return sendError(res, result.message, undefined, 400);
      }
    } catch (error) {
      logger.error('Update student personal info controller error:', error);
      return sendError(
        res,
        'Cập nhật thông tin cá nhân thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }

  // Update student preferences
  static async updatePreferences(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Không tìm thấy thông tin xác thực', undefined, 401);
      }

      const profileData = req.body;

      logger.info(`Updating student preferences for user: ${userId}`);

      const result = await studentService.updatePreferences(userId, profileData);

      if (result.success) {
        return sendSuccess(res, result.message, result.data);
      } else {
        return sendError(res, result.message, undefined, 400);
      }
    } catch (error) {
      logger.error('Update student preferences controller error:', error);
      return sendError(
        res,
        'Cập nhật sở thích học tập thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }
}