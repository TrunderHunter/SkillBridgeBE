import { User, TutorProfile } from '../../models';
import { uploadToCloudinary } from '../../config';
import { ITutorProfileInput, Gender } from '../../types/user.types';
import { logger } from '../../utils/logger';

export interface TutorProfileResponse {
  success: boolean;
  message: string;
  data?: {
    user: any;
    profile: any;
  };
}

export interface UpdatePersonalInfoResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface UpdateIntroductionResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface PersonalInfoInput {
  full_name?: string;
  phone_number?: string;
  gender?: Gender;
  date_of_birth?: string;
  address?: string;
}

class TutorService {
  /**
   * Extract first validation error message from Mongoose ValidationError
   */
  private getValidationErrorMessage(error: any): string {
    if (error.name === 'ValidationError' && error.errors) {
      // Get first error message (they're already in Vietnamese from model)
      const firstField = Object.keys(error.errors)[0];
      return error.errors[firstField].message;
    }
    return 'Dữ liệu không hợp lệ';
  }
  /**
   * Get tutor profile (personal info + tutor profile)
   */
  async getProfile(userId: string): Promise<TutorProfileResponse> {
    try {
      logger.info(`Getting tutor profile for user: ${userId}`);

      // Get user data
      const user = await User.findById(userId).select('-password_hash');
      if (!user) {
        return {
          success: false,
          message: 'Không tìm thấy người dùng',
        };
      }

      // Get or create tutor profile
      let tutorProfile = await TutorProfile.findOne({ user_id: userId });
      if (!tutorProfile) {
        // Auto-create TutorProfile with default values
        tutorProfile = new TutorProfile({
          user_id: userId,
          headline: '',
          introduction: '',
          teaching_experience: '',
          student_levels: '',
          video_intro_link: '',
          cccd_images: [],
        });
        await tutorProfile.save();
        logger.info(`Auto-created TutorProfile for user: ${userId}`);
      }

      return {
        success: true,
        message: 'Lấy thông tin hồ sơ thành công',
        data: {
          user: user.toJSON(),
          profile: tutorProfile.toJSON(),
        },
      };
    } catch (error) {
      logger.error('Get tutor profile error:', error);
      return {
        success: false,
        message: 'Không thể lấy thông tin hồ sơ. Vui lòng thử lại sau.',
      };
    }
  }

  /**
   * Update personal info (User model)
   */
  async updatePersonalInfo(
    userId: string,
    personalInfo: PersonalInfoInput,
    avatarFile?: Express.Multer.File
  ): Promise<UpdatePersonalInfoResponse> {
    try {
      logger.info(`Updating personal info for user: ${userId}`);

      const { full_name, phone_number, gender, date_of_birth, address } =
        personalInfo;

      // Prepare update data
      const updateData: any = {};

      if (full_name) updateData.full_name = full_name;
      if (phone_number) updateData.phone_number = phone_number;
      if (gender && Object.values(Gender).includes(gender)) {
        updateData.gender = gender;
      }
      if (date_of_birth) updateData.date_of_birth = new Date(date_of_birth);
      if (address) updateData.address = address;

      // Handle avatar upload
      if (avatarFile) {
        try {
          const avatarUrl = await uploadToCloudinary(
            avatarFile.buffer,
            'skillbridge/avatars',
            `avatar_${userId}`
          );
          updateData.avatar_url = avatarUrl;
          logger.info(`Avatar uploaded successfully for user: ${userId}`);
        } catch (uploadError) {
          logger.error('Avatar upload error:', uploadError);
          return {
            success: false,
            message: 'Không thể tải lên ảnh đại diện. Vui lòng thử lại.',
          };
        }
      }

      // Update user
      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        select: '-password_hash',
      });

      if (!updatedUser) {
        return {
          success: false,
          message: 'Không tìm thấy người dùng',
        };
      }

      logger.info(`Personal info updated successfully for user: ${userId}`);
      return {
        success: true,
        message: 'Cập nhật thông tin cá nhân thành công',
        data: updatedUser.toJSON(),
      };
    } catch (error: any) {
      logger.error('Update personal info error:', error);

      // Handle validation errors specifically
      if (error.name === 'ValidationError') {
        return {
          success: false,
          message: this.getValidationErrorMessage(error),
        };
      }

      return {
        success: false,
        message: 'Không thể cập nhật thông tin cá nhân. Vui lòng thử lại sau.',
      };
    }
  }

  /**
   * Update tutor profile introduction
   */
  async updateIntroduction(
    userId: string,
    tutorProfileData: ITutorProfileInput
  ): Promise<UpdateIntroductionResponse> {
    try {
      logger.info(`Updating introduction for user: ${userId}`);

      // Remove undefined values
      const cleanData: Partial<ITutorProfileInput> = {};
      Object.entries(tutorProfileData).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanData[key as keyof ITutorProfileInput] = value;
        }
      });

      // Find and update or create tutor profile
      let tutorProfile = await TutorProfile.findOne({ user_id: userId });

      if (!tutorProfile) {
        // Create new profile if doesn't exist
        tutorProfile = new TutorProfile({
          user_id: userId,
          ...cleanData,
          cccd_images: [], // Initialize with empty array
        });
        logger.info(`Creating new tutor profile for user: ${userId}`);
      } else {
        // Update existing profile
        Object.assign(tutorProfile, cleanData);
        logger.info(`Updating existing tutor profile for user: ${userId}`);
      }

      await tutorProfile.save();

      return {
        success: true,
        message: 'Cập nhật thông tin giới thiệu thành công',
        data: tutorProfile.toJSON(),
      };
    } catch (error: any) {
      logger.error('Update introduction error:', error);

      // Handle validation errors specifically
      if (error.name === 'ValidationError') {
        return {
          success: false,
          message: this.getValidationErrorMessage(error),
        };
      }

      return {
        success: false,
        message:
          'Không thể cập nhật thông tin giới thiệu. Vui lòng thử lại sau.',
      };
    }
  }
}

export const tutorService = new TutorService();
