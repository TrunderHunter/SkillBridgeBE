import { TutorProfile } from '../../models/TutorProfile';
import { VerificationStatus } from '../../types/verification.types';
import { logger } from '../../utils/logger';

export interface SubmitVerificationResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface ApproveProfileResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface RejectProfileResponse {
  success: boolean;
  message: string;
  data?: any;
}

class TutorProfileService {
  /**
   * Submit TutorProfile for verification
   * Validates required fields and changes status from DRAFT to PENDING
   */
  async submitProfileVerification(
    userId: string
  ): Promise<SubmitVerificationResponse> {
    try {
      logger.info(`Submitting profile verification for user: ${userId}`);

      const tutorProfile = await TutorProfile.findOne({ user_id: userId });

      if (!tutorProfile) {
        return {
          success: false,
          message: 'Không tìm thấy hồ sơ gia sư',
        };
      }

      // Check if already submitted or approved
      if (tutorProfile.status === VerificationStatus.PENDING) {
        return {
          success: false,
          message: 'Hồ sơ đang chờ xác thực',
        };
      }

      if (tutorProfile.status === VerificationStatus.VERIFIED) {
        return {
          success: false,
          message: 'Hồ sơ đã được xác thực',
        };
      }

      // Validate required fields
      const errors: string[] = [];

      if (!tutorProfile.headline || tutorProfile.headline.trim() === '') {
        errors.push('Tiêu đề giới thiệu là bắt buộc');
      }

      if (
        !tutorProfile.introduction ||
        tutorProfile.introduction.trim() === ''
      ) {
        errors.push('Phần giới thiệu là bắt buộc');
      }

      if (
        !tutorProfile.teaching_experience ||
        tutorProfile.teaching_experience.trim() === ''
      ) {
        errors.push('Kinh nghiệm giảng dạy là bắt buộc');
      }

      if (!tutorProfile.cccd_images || tutorProfile.cccd_images.length < 2) {
        errors.push('Cần tải lên ít nhất 2 ảnh CCCD');
      }

      if (errors.length > 0) {
        return {
          success: false,
          message: `Vui lòng hoàn thiện thông tin: ${errors.join(', ')}`,
        };
      }

      // Update status to PENDING
      tutorProfile.status = VerificationStatus.PENDING;
      await tutorProfile.save();

      logger.info(
        `Profile verification submitted successfully for user: ${userId}`
      );

      return {
        success: true,
        message:
          'Gửi yêu cầu xác thực thành công. Vui lòng chờ admin phê duyệt.',
        data: tutorProfile.toJSON(),
      };
    } catch (error) {
      logger.error('Submit profile verification error:', error);
      return {
        success: false,
        message: 'Không thể gửi yêu cầu xác thực. Vui lòng thử lại sau.',
      };
    }
  }

  /**
   * Admin approves tutor profile
   * Changes status from PENDING to VERIFIED and saves verification metadata
   */
  async approveProfile(
    tutorProfileId: string,
    adminUserId: string
  ): Promise<ApproveProfileResponse> {
    try {
      logger.info(`Admin ${adminUserId} approving profile: ${tutorProfileId}`);

      const tutorProfile = await TutorProfile.findById(tutorProfileId);

      if (!tutorProfile) {
        return {
          success: false,
          message: 'Không tìm thấy hồ sơ gia sư',
        };
      }

      if (tutorProfile.status !== VerificationStatus.PENDING) {
        return {
          success: false,
          message: 'Chỉ có thể phê duyệt hồ sơ đang chờ xác thực',
        };
      }

      // Backup current data before approval
      tutorProfile.verified_data = {
        headline: tutorProfile.headline,
        introduction: tutorProfile.introduction,
        teaching_experience: tutorProfile.teaching_experience,
        student_levels: tutorProfile.student_levels,
        video_intro_link: tutorProfile.video_intro_link,
        cccd_images: [...tutorProfile.cccd_images],
      };

      // Update verification metadata
      tutorProfile.status = VerificationStatus.VERIFIED;
      tutorProfile.verified_at = new Date();
      tutorProfile.verified_by = adminUserId;
      tutorProfile.rejection_reason = undefined; // Clear any previous rejection reason

      await tutorProfile.save();

      logger.info(
        `Profile approved successfully: ${tutorProfileId} by admin: ${adminUserId}`
      );

      return {
        success: true,
        message: 'Phê duyệt hồ sơ gia sư thành công',
        data: tutorProfile.toJSON(),
      };
    } catch (error) {
      logger.error('Approve profile error:', error);
      return {
        success: false,
        message: 'Không thể phê duyệt hồ sơ. Vui lòng thử lại sau.',
      };
    }
  }

  /**
   * Admin rejects tutor profile
   * Changes status from PENDING to REJECTED and saves rejection reason
   */
  async rejectProfile(
    tutorProfileId: string,
    adminUserId: string,
    rejectionReason: string
  ): Promise<RejectProfileResponse> {
    try {
      logger.info(`Admin ${adminUserId} rejecting profile: ${tutorProfileId}`);

      if (!rejectionReason || rejectionReason.trim() === '') {
        return {
          success: false,
          message: 'Lý do từ chối là bắt buộc',
        };
      }

      const tutorProfile = await TutorProfile.findById(tutorProfileId);

      if (!tutorProfile) {
        return {
          success: false,
          message: 'Không tìm thấy hồ sơ gia sư',
        };
      }

      if (tutorProfile.status !== VerificationStatus.PENDING) {
        return {
          success: false,
          message: 'Chỉ có thể từ chối hồ sơ đang chờ xác thực',
        };
      }

      // Update status and rejection reason
      tutorProfile.status = VerificationStatus.REJECTED;
      tutorProfile.rejection_reason = rejectionReason;
      tutorProfile.verified_by = adminUserId;
      tutorProfile.verified_at = new Date(); // Track when rejection happened

      await tutorProfile.save();

      logger.info(
        `Profile rejected successfully: ${tutorProfileId} by admin: ${adminUserId}`
      );

      return {
        success: true,
        message: 'Từ chối hồ sơ gia sư thành công',
        data: tutorProfile.toJSON(),
      };
    } catch (error) {
      logger.error('Reject profile error:', error);
      return {
        success: false,
        message: 'Không thể từ chối hồ sơ. Vui lòng thử lại sau.',
      };
    }
  }

  /**
   * Check if tutor can operate (create posts, accept students, etc.)
   * Returns true only if profile status is VERIFIED
   */
  async canTutorOperate(userId: string): Promise<boolean> {
    try {
      const tutorProfile = await TutorProfile.findOne({ user_id: userId });

      if (!tutorProfile) {
        return false;
      }

      return tutorProfile.status === VerificationStatus.VERIFIED;
    } catch (error) {
      logger.error('Check tutor operation permission error:', error);
      return false;
    }
  }

  /**
   * Get tutor profile by user ID
   */
  async getProfileByUserId(userId: string) {
    try {
      const tutorProfile = await TutorProfile.findOne({ user_id: userId });
      return tutorProfile;
    } catch (error) {
      logger.error('Get profile by user ID error:', error);
      return null;
    }
  }

  /**
   * Get tutor profile by profile ID
   */
  async getProfileById(profileId: string) {
    try {
      const tutorProfile = await TutorProfile.findById(profileId);
      return tutorProfile;
    } catch (error) {
      logger.error('Get profile by ID error:', error);
      return null;
    }
  }

  /**
   * Get all pending verification profiles (for admin)
   */
  async getPendingVerifications() {
    try {
      const profiles = await TutorProfile.find({
        status: VerificationStatus.PENDING,
      })
        .populate('user_id', 'full_name email phone_number avatar_url')
        .sort({ updated_at: -1 });

      return {
        success: true,
        data: profiles,
      };
    } catch (error) {
      logger.error('Get pending verifications error:', error);
      return {
        success: false,
        message: 'Không thể lấy danh sách yêu cầu xác thực',
      };
    }
  }
}

export const tutorProfileService = new TutorProfileService();
