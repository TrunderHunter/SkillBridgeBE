import { User } from '../../models/User';
import { StudentProfile } from '../../models/StudentProfile';
import { uploadToCloudinary } from '../../config/cloudinary';
import { logger } from '../../utils/logger';
import { Gender } from '../../types/user.types';
import { 
  IStudentProfileInput, 
  StudentPersonalInfoInput 
} from '../../types/student.types';

export interface StudentProfileResponse {
  success: boolean;
  message: string;
  data?: {
    user: any;
    profile: any;
  };
}

export interface UpdateStudentInfoResponse {
  success: boolean;
  message: string;
  data?: any;
}

class UploadService {
  static async uploadImage(
    file: Express.Multer.File,
    folder: string
  ): Promise<{ secure_url: string }> {
    try {
      const result = await uploadToCloudinary(
        file.buffer,
        `skillbridge/${folder}`,
        file.originalname
      );
      return { secure_url: result };
    } catch (error: any) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }
}

class StudentService {
  /**
   * Extract first validation error message from Mongoose ValidationError
   */
  private getValidationErrorMessage(error: any): string {
    if (error.name === 'ValidationError' && error.errors) {
      const firstField = Object.keys(error.errors)[0];
      return error.errors[firstField].message;
    }
    
    // ➕ Thêm xử lý cho các loại lỗi khác
    if (error.code === 11000) {
      return 'Dữ liệu đã tồn tại trong hệ thống';
    }
    
    if (error.name === 'CastError') {
      return 'Định dạng dữ liệu không hợp lệ';
    }
    
    return 'Dữ liệu không hợp lệ';
  }

  // ✅ Thêm method kiểm tra user tồn tại và có role student
  private async validateStudentUser(userId: string) {
    const user = await User.findById(userId).select('-password_hash');
    
    if (!user) {
      throw new Error('Không tìm thấy thông tin người dùng');
    }
    
    if (user.role.toLowerCase() !== 'student') {
      throw new Error('Chỉ học viên mới có thể thực hiện thao tác này');
    }
    
    if (user.status !== 'active') {
      throw new Error('Tài khoản chưa được kích hoạt hoặc đã bị khóa');
    }
    
    return user;
  }

  /**
   * Get student profile (personal info + student profile)
   */
  async getProfile(userId: string): Promise<StudentProfileResponse> {
    try {
      logger.info(`Getting student profile for user: ${userId}`);

      // ✅ Sử dụng method validation mới
      const user = await this.validateStudentUser(userId);

      // Get or create student profile
      let profile = await StudentProfile.findOne({ user_id: userId });
      
      if (!profile) {
        // Create default profile if not exists
        profile = new StudentProfile({
          user_id: userId,
          status: 'draft'
        });
        await profile.save();
        logger.info(`Created new student profile for user: ${userId}`);
      }

      return {
        success: true,
        message: 'Lấy thông tin hồ sơ thành công',
        data: {
          user: user.toObject(),
          profile: profile.toObject()
        }
      };
    } catch (error: any) {
      logger.error('Get student profile error:', error);
      return {
        success: false,
        message: error.message || 'Lấy thông tin hồ sơ thất bại'
      };
    }
  }

  /**
   * Update personal info (User model)
   */
  async updatePersonalInfo(
    userId: string,
    personalInfo: StudentPersonalInfoInput,
    avatarFile?: Express.Multer.File
  ): Promise<UpdateStudentInfoResponse> {
    try {
      logger.info(`Updating student personal info for user: ${userId}`);

      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'Không tìm thấy thông tin người dùng'
        };
      }

      // Handle avatar upload
      if (avatarFile) {
        try {
          const uploadResult = await UploadService.uploadImage(avatarFile, 'avatars');
          personalInfo.avatar_url = uploadResult.secure_url;
        } catch (uploadError) {
          logger.error('Avatar upload error:', uploadError);
          return {
            success: false,
            message: 'Tải lên ảnh đại diện thất bại'
          };
        }
      }

      // Kiểm tra và parse structured_address nếu nó là một chuỗi JSON
      if (personalInfo.structured_address && typeof personalInfo.structured_address === 'string') {
        try {
          personalInfo.structured_address = JSON.parse(personalInfo.structured_address);
        } catch (error) {
          logger.error('Failed to parse structured_address JSON string:', error);
          return {
            success: false,
            message: 'Định dạng structured_address không hợp lệ. Vui lòng kiểm tra lại.'
          };
        }
      }
      
      // Update user fields
      Object.keys(personalInfo).forEach(key => {
        if (personalInfo[key as keyof StudentPersonalInfoInput] !== undefined) {
          (user as any)[key] = personalInfo[key as keyof StudentPersonalInfoInput];
        }
      });

      await user.save();

      return {
        success: true,
        message: 'Cập nhật thông tin cá nhân thành công',
        data: user.toObject()
      };
    } catch (error: any) {
      logger.error('Update student personal info error:', error);
      
      if (error.name === 'ValidationError') {
        return {
          success: false,
          message: this.getValidationErrorMessage(error)
        };
      }

      return {
        success: false,
        message: 'Cập nhật thông tin cá nhân thất bại'
      };
    }
  }

  /**
   * Update student profile preferences
   */
  async updatePreferences(
    userId: string,
    profileData: IStudentProfileInput
  ): Promise<UpdateStudentInfoResponse> {
    try {
      logger.info(`Updating student preferences for user: ${userId}`);

      // Validate budget range
      if (profileData.budget_range) {
        const { min, max } = profileData.budget_range;
        if (min !== undefined && max !== undefined && min > max) {
          return {
            success: false,
            message: 'Giá tối thiểu không thể lớn hơn giá tối đa'
          };
        }
      }

      let profile = await StudentProfile.findOne({ user_id: userId });
      
      if (!profile) {
        // Create new profile
        profile = new StudentProfile({
          user_id: userId,
          ...profileData,
          status: 'active'
        });
      } else {
        // Update existing profile
        Object.keys(profileData).forEach(key => {
          if (profileData[key as keyof IStudentProfileInput] !== undefined) {
            (profile as any)[key] = profileData[key as keyof IStudentProfileInput];
          }
        });
        
        if (profile.status === 'draft') {
          profile.status = 'active';
        }
      }

      await profile.save();

      return {
        success: true,
        message: 'Cập nhật sở thích học tập thành công',
        data: profile.toObject()
      };
    } catch (error: any) {
      logger.error('Update student preferences error:', error);
      
      if (error.name === 'ValidationError') {
        return {
          success: false,
          message: this.getValidationErrorMessage(error)
        };
      }

      return {
        success: false,
        message: 'Cập nhật sở thích học tập thất bại'
      };
    }
  }
}

export const studentService = new StudentService();