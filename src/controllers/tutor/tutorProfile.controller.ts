import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError, sendResponse } from '../../utils/response';
import { tutorService, cccdService } from '../../services/tutor';
import { QualificationService } from '../../services/qualification';
import { tutorProfileService } from '../../services/tutorProfile/tutorProfile.service';
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

      // Kiểm tra quyền chỉnh sửa thông tin gia sư
      const canEditResult =
        await QualificationService.canEditTutorProfile(userId);

      if (!canEditResult.canEdit) {
        return sendResponse(
          res,
          403,
          false,
          canEditResult.message || 'Không thể chỉnh sửa thông tin',
          {
            status: canEditResult.status,
            canEdit: false,
          }
        );
      }

      // Nếu có cảnh báo và chưa được confirm, trả về thông tin cảnh báo
      if (canEditResult.warning && !req.body.confirmed) {
        return sendResponse(res, 200, false, canEditResult.warning, {
          status: canEditResult.status,
          canEdit: true,
          warning: canEditResult.warning,
          requiresConfirmation: true,
        }); // 200 để frontend có thể xử lý warning
      }

      logger.info(`Updating personal info for user: ${userId}`);

      // Parse structured_address if it's a JSON string
      let structured_address = req.body.structured_address;
      if (typeof structured_address === 'string') {
        try {
          structured_address = JSON.parse(structured_address);
        } catch (error) {
          console.error('Error parsing structured_address:', error);
          structured_address = null;
        }
      }

      const personalInfoData = {
        full_name: req.body.full_name,
        phone_number: req.body.phone_number,
        gender: req.body.gender,
        date_of_birth: req.body.date_of_birth,
        address: req.body.address,
        structured_address: structured_address,
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

  // Kiểm tra trạng thái có thể chỉnh sửa thông tin gia sư
  static async checkEditStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Người dùng chưa được xác thực', undefined, 401);
      }

      logger.info(`Checking edit status for user: ${userId}`);

      const result = await QualificationService.canEditTutorProfile(userId);

      sendSuccess(res, 'Kiểm tra trạng thái thành công', {
        canEdit: result.canEdit,
        status: result.status,
        warning: result.warning,
        message: result.message,
      });
    } catch (error) {
      logger.error('Check edit status controller error:', error);
      sendError(
        res,
        'Kiểm tra trạng thái chỉnh sửa thất bại. Vui lòng thử lại sau.',
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

      // Kiểm tra quyền chỉnh sửa thông tin gia sư
      const canEditResult =
        await QualificationService.canEditTutorProfile(userId);

      if (!canEditResult.canEdit) {
        return sendResponse(
          res,
          403,
          false,
          canEditResult.message || 'Không thể chỉnh sửa thông tin',
          {
            status: canEditResult.status,
            canEdit: false,
          }
        );
      }

      // Nếu có cảnh báo và chưa được confirm, trả về thông tin cảnh báo
      if (canEditResult.warning && !req.body.confirmed) {
        return sendResponse(res, 200, false, canEditResult.warning, {
          status: canEditResult.status,
          canEdit: true,
          warning: canEditResult.warning,
          requiresConfirmation: true,
        });
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

  // Gửi yêu cầu xác thực thông tin gia sư
  static async submitForVerification(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Người dùng chưa được xác thực', undefined, 401);
      }

      logger.info(`Submitting tutor profile for verification: ${userId}`);

      // Lấy tutorProfileId từ user
      const tutorProfile = await tutorService.getProfile(userId);
      if (!tutorProfile.success || !tutorProfile.data?.profile?.id) {
        return sendError(
          res,
          'Không tìm thấy thông tin gia sư',
          undefined,
          404
        );
      }

      const tutorProfileId = tutorProfile.data.profile.id;

      const result =
        await QualificationService.createTutorProfileVerificationRequest(
          userId,
          tutorProfileId
        );

      sendSuccess(res, 'Gửi yêu cầu xác thực thành công', {
        requestId: result._id,
        status: result.status,
        submittedAt: result.submittedAt,
      });
    } catch (error: any) {
      logger.error('Submit for verification controller error:', error);

      // Xử lý các loại lỗi khác nhau
      if (error.message.includes('đang chờ xử lý')) {
        sendResponse(res, 409, false, error.message, {
          errorType: 'PENDING_REQUEST',
          canRetry: false,
        });
      } else if (error.message.includes('Không tìm thấy')) {
        sendResponse(res, 404, false, error.message, {
          errorType: 'NOT_FOUND',
          canRetry: false,
        });
      } else if (error.message.includes('quyền truy cập')) {
        sendResponse(res, 403, false, error.message, {
          errorType: 'ACCESS_DENIED',
          canRetry: false,
        });
      } else {
        sendResponse(
          res,
          500,
          false,
          'Gửi yêu cầu xác thực thất bại. Vui lòng thử lại sau.',
          {
            errorType: 'INTERNAL_ERROR',
            canRetry: true,
          }
        );
      }
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

  // ==================== CHECK TUTOR OPERATION STATUS ====================

  /**
   * Check if tutor can operate (create posts, etc.)
   * GET /api/v1/tutor/profile/can-operate
   */
  static async checkCanOperate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Người dùng chưa được xác thực', undefined, 401);
      }

      const canOperate = await tutorProfileService.canTutorOperate(userId);
      const profile = await tutorProfileService.getProfileByUserId(userId);

      sendSuccess(res, 'Kiểm tra quyền hoạt động thành công', {
        canOperate,
        profileStatus: profile?.status || 'DRAFT',
        verifiedAt: profile?.verified_at,
      });
    } catch (error) {
      logger.error('Check can operate controller error:', error);
      sendError(
        res,
        'Kiểm tra quyền hoạt động thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }
}
