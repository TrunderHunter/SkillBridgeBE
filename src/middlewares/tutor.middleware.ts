import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { TutorProfile } from '../models/TutorProfile';
import { Education } from '../models/Education';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';

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
      tutorId: req.tutorProfile!._id,
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
