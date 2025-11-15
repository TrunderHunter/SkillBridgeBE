import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { TutorProfile } from '../models/TutorProfile';
import { Education } from '../models/Education';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { VerificationStatus } from '../types/verification.types';

// Middleware kiểm tra user có role TUTOR
export const requireTutorRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;

    if (!user) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    if (user.role !== 'TUTOR') {
      return sendError(res, 'Tutor role required', undefined, 403);
    }

    next();
  } catch (error) {
    logger.error('Tutor role check error:', error);
    return sendError(res, 'Authorization failed', undefined, 500);
  }
};

// Middleware kiểm tra TutorProfile đã được xác thực
export const requireVerifiedTutorProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;

    const tutorProfile = await TutorProfile.findOne({ user_id: userId });

    if (!tutorProfile) {
      return sendError(
        res,
        'Tutor profile not found. Please complete your profile first.',
        undefined,
        400
      );
    }

    if (tutorProfile.status !== 'VERIFIED') {
      return sendError(
        res,
        'Personal information must be verified before creating posts.',
        undefined,
        400
      );
    }

    // Lưu tutorProfile vào request để sử dụng sau
    req.tutorProfile = tutorProfile;
    next();
  } catch (error) {
    logger.error('Tutor profile verification check error:', error);
    return sendError(res, 'Profile verification check failed', undefined, 500);
  }
};

// Middleware kiểm tra trình độ học vấn đã được xác thực
export const requireVerifiedEducation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tutorProfile = req.tutorProfile;

    if (!tutorProfile) {
      // Nếu chưa có tutorProfile trong request, thì lấy lại
      const userId = req.user!.id;
      const profile = await TutorProfile.findOne({ user_id: userId });

      if (!profile) {
        return sendError(res, 'Tutor profile not found', undefined, 400);
      }

      req.tutorProfile = profile;
    }

    // Kiểm tra có ít nhất một trình độ học vấn được xác thực
    const verifiedEducations = await Education.find({
      tutorId: req.tutorProfile!.user_id,
      status: 'VERIFIED',
    });

    if (verifiedEducations.length === 0) {
      return sendError(
        res,
        'At least one education qualification must be verified before creating posts.',
        undefined,
        400
      );
    }

    next();
  } catch (error) {
    logger.error('Education verification check error:', error);
    return sendError(
      res,
      'Education verification check failed',
      undefined,
      500
    );
  }
};

// Middleware tổng hợp kiểm tra đầy đủ điều kiện để đăng bài
export const requireTutorQualification = [
  requireTutorRole,
  requireVerifiedTutorProfile,
  requireVerifiedEducation,
];

// Middleware kiểm tra admin role (cho quản lý môn học)
export const requireAdminRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;

    if (!user) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    if (user.role !== 'ADMIN') {
      return sendError(res, 'Admin role required', undefined, 403);
    }

    next();
  } catch (error) {
    logger.error('Admin role check error:', error);
    return sendError(res, 'Authorization failed', undefined, 500);
  }
};

// Middleware kiểm tra quyền sở hữu bài đăng (chỉ tutor tạo bài mới được sửa/xóa)
export const requirePostOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { postId } = req.params;
    const userId = req.user!.id;

    // Kiểm tra sẽ được thực hiện trong service layer
    // Middleware này chỉ đảm bảo có postId và userId
    if (!postId) {
      return sendError(res, 'Post ID is required', undefined, 400);
    }

    next();
  } catch (error) {
    logger.error('Post ownership check error:', error);
    return sendError(res, 'Ownership check failed', undefined, 500);
  }
};

/**
 * NEW MIDDLEWARE: Require Approved TutorProfile
 * Checks if tutor's profile has been approved (status === VERIFIED)
 * This is the new requirement for tutors to operate
 */
// Export alias for compatibility
export const tutorMiddleware = requireTutorRole;

export const requireApprovedTutorProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;

    const tutorProfile = await TutorProfile.findOne({ user_id: userId });

    if (!tutorProfile) {
      return sendError(
        res,
        'Bạn chưa có hồ sơ gia sư. Vui lòng hoàn thiện hồ sơ trước.',
        undefined,
        400
      );
    }

    if (tutorProfile.status !== VerificationStatus.VERIFIED) {
      const statusMessages: Record<string, string> = {
        [VerificationStatus.DRAFT]:
          'Hồ sơ gia sư chưa hoàn thiện. Vui lòng hoàn thiện và gửi yêu cầu xác thực.',
        [VerificationStatus.PENDING]:
          'Hồ sơ gia sư đang chờ xác thực. Vui lòng chờ admin phê duyệt.',
        [VerificationStatus.REJECTED]:
          'Hồ sơ gia sư bị từ chối. Vui lòng chỉnh sửa và gửi lại yêu cầu xác thực.',
        [VerificationStatus.MODIFIED_PENDING]:
          'Hồ sơ đã chỉnh sửa đang chờ xác thực lại. Vui lòng chờ admin phê duyệt.',
        [VerificationStatus.MODIFIED_AFTER_REJECTION]:
          'Hồ sơ đã chỉnh sửa sau khi bị từ chối. Vui lòng gửi yêu cầu xác thực.',
      };

      return sendError(
        res,
        statusMessages[tutorProfile.status || ''] ||
          'Hồ sơ gia sư chưa được xác thực',
        undefined,
        403
      );
    }

    // Lưu tutorProfile vào request để sử dụng sau
    req.tutorProfile = tutorProfile;
    next();
  } catch (error) {
    logger.error('Approved tutor profile check error:', error);
    return sendError(
      res,
      'Không thể kiểm tra trạng thái hồ sơ',
      undefined,
      500
    );
  }
};
