import { TutorProfile } from '../../models';
import { uploadToCloudinary } from '../../config';
import { logger } from '../../utils/logger';

export interface CCCDUploadResponse {
  success: boolean;
  message: string;
  data?: {
    cccd_images: string[];
    uploaded_count: number;
  };
}

export interface CCCDDeleteResponse {
  success: boolean;
  message: string;
  data?: {
    cccd_images: string[];
  };
}

export interface CCCDGetResponse {
  success: boolean;
  message: string;
  data?: {
    cccd_images: string[];
  };
}

class CCCDService {
  private readonly MAX_CCCD_IMAGES = 10;

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
   * Upload CCCD images for tutor
   */
  async uploadImages(
    userId: string,
    files: Express.Multer.File[]
  ): Promise<CCCDUploadResponse> {
    try {
      logger.info(
        `Uploading CCCD images for user: ${userId}, count: ${files.length}`
      );

      if (!files || files.length === 0) {
        return {
          success: false,
          message: 'Không có ảnh CCCD nào được cung cấp',
        };
      }

      // Validate file count (max 10 total)
      let tutorProfile = await TutorProfile.findOne({ user_id: userId });
      const currentImagesCount = tutorProfile?.cccd_images?.length || 0;

      if (currentImagesCount + files.length > this.MAX_CCCD_IMAGES) {
        return {
          success: false,
          message: `Không thể tải lên quá ${this.MAX_CCCD_IMAGES} ảnh CCCD`,
        };
      }

      // Upload all images to Cloudinary
      const uploadPromises = files.map((file, index) =>
        uploadToCloudinary(
          file.buffer,
          'skillbridge/cccd',
          `cccd_${userId}_${Date.now()}_${index}`
        )
      );

      const uploadedUrls = await Promise.all(uploadPromises);
      logger.info(
        `Successfully uploaded ${uploadedUrls.length} CCCD images to Cloudinary`
      );

      // Find and update or create tutor profile
      if (!tutorProfile) {
        tutorProfile = new TutorProfile({
          user_id: userId,
          cccd_images: uploadedUrls,
          headline: '',
          introduction: '',
          teaching_experience: '',
          student_levels: '',
          video_intro_link: '',
        });
        logger.info(
          `Created new tutor profile with CCCD images for user: ${userId}`
        );
      } else {
        // Add new CCCD images to existing ones
        tutorProfile.cccd_images = [
          ...(tutorProfile.cccd_images || []),
          ...uploadedUrls,
        ];
        logger.info(
          `Added ${uploadedUrls.length} CCCD images to existing profile for user: ${userId}`
        );
      }

      await tutorProfile.save();

      return {
        success: true,
        message: 'Tải ảnh CCCD thành công',
        data: {
          cccd_images: tutorProfile.cccd_images,
          uploaded_count: files.length,
        },
      };
    } catch (error: any) {
      logger.error('Upload CCCD images error:', error);

      // Handle validation errors specifically
      if (error.name === 'ValidationError') {
        return {
          success: false,
          message: this.getValidationErrorMessage(error),
        };
      }

      return {
        success: false,
        message: 'Không thể tải lên ảnh CCCD. Vui lòng thử lại sau.',
      };
    }
  }

  /**
   * Delete CCCD image
   */
  async deleteImage(
    userId: string,
    imageUrl: string
  ): Promise<CCCDDeleteResponse> {
    try {
      logger.info(
        `Deleting CCCD image for user: ${userId}, image: ${imageUrl}`
      );

      if (!imageUrl) {
        return {
          success: false,
          message: 'URL ảnh là bắt buộc',
        };
      }

      // Find tutor profile
      const tutorProfile = await TutorProfile.findOne({ user_id: userId });

      if (!tutorProfile) {
        return {
          success: false,
          message: 'Không tìm thấy hồ sơ gia sư',
        };
      }

      // Check if image exists
      if (!tutorProfile.cccd_images.includes(imageUrl)) {
        return {
          success: false,
          message: 'Không tìm thấy ảnh',
        };
      }

      // Remove image from array
      tutorProfile.cccd_images = tutorProfile.cccd_images.filter(
        (img) => img !== imageUrl
      );
      await tutorProfile.save();

      logger.info(`Successfully deleted CCCD image for user: ${userId}`);

      // TODO: Delete from Cloudinary as well
      // Extract public_id from imageUrl and delete from cloudinary
      // This should be implemented for complete cleanup

      return {
        success: true,
        message: 'Xóa ảnh CCCD thành công',
        data: {
          cccd_images: tutorProfile.cccd_images,
        },
      };
    } catch (error: any) {
      logger.error('Delete CCCD image error:', error);

      // Handle validation errors specifically
      if (error.name === 'ValidationError') {
        return {
          success: false,
          message: this.getValidationErrorMessage(error),
        };
      }

      return {
        success: false,
        message: 'Không thể xóa ảnh CCCD. Vui lòng thử lại sau.',
      };
    }
  }

  /**
   * Get CCCD images
   */
  async getImages(userId: string): Promise<CCCDGetResponse> {
    try {
      logger.info(`Getting CCCD images for user: ${userId}`);

      // Find tutor profile
      const tutorProfile = await TutorProfile.findOne({ user_id: userId });

      if (!tutorProfile) {
        // Return empty array if profile doesn't exist
        return {
          success: true,
          message: 'Lấy danh sách ảnh CCCD thành công',
          data: {
            cccd_images: [],
          },
        };
      }

      return {
        success: true,
        message: 'Lấy danh sách ảnh CCCD thành công',
        data: {
          cccd_images: tutorProfile.cccd_images || [],
        },
      };
    } catch (error: any) {
      logger.error('Get CCCD images error:', error);
      return {
        success: false,
        message: 'Không thể lấy danh sách ảnh CCCD. Vui lòng thử lại sau.',
      };
    }
  }

  /**
   * Validate CCCD image count before upload
   */
  async validateImageCount(
    userId: string,
    newImagesCount: number
  ): Promise<boolean> {
    try {
      const tutorProfile = await TutorProfile.findOne({ user_id: userId });
      const currentImagesCount = tutorProfile?.cccd_images?.length || 0;
      return currentImagesCount + newImagesCount <= this.MAX_CCCD_IMAGES;
    } catch (error) {
      logger.error('Validate CCCD image count error:', error);
      return false;
    }
  }
}

export const cccdService = new CCCDService();
