import { uploadToCloudinary } from '../../config/cloudinary';

export class UploadService {
  /**
   * Upload ảnh cho Education
   */
  static async uploadEducationImage(
    buffer: Buffer,
    tutorId: string,
    filename?: string
  ): Promise<string> {
    try {
      const folder = `skillbridge/education/${tutorId}`;
      const imageUrl = await uploadToCloudinary(buffer, folder, filename);
      return imageUrl;
    } catch (error: any) {
      throw new Error(`Lỗi upload ảnh học vấn: ${error.message}`);
    }
  }

  /**
   * Upload ảnh cho Certificate
   */
  static async uploadCertificateImage(
    buffer: Buffer,
    tutorId: string,
    filename?: string
  ): Promise<string> {
    try {
      const folder = `skillbridge/certificates/${tutorId}`;
      const imageUrl = await uploadToCloudinary(buffer, folder, filename);
      return imageUrl;
    } catch (error: any) {
      throw new Error(`Lỗi upload ảnh chứng chỉ: ${error.message}`);
    }
  }

  /**
   * Upload ảnh cho Achievement
   */
  static async uploadAchievementImage(
    buffer: Buffer,
    tutorId: string,
    filename?: string
  ): Promise<string> {
    try {
      const folder = `skillbridge/achievements/${tutorId}`;
      const imageUrl = await uploadToCloudinary(buffer, folder, filename);
      return imageUrl;
    } catch (error: any) {
      throw new Error(`Lỗi upload ảnh thành tích: ${error.message}`);
    }
  }

  /**
   * Upload nhiều ảnh cùng lúc
   */
  static async uploadMultipleImages(
    files: {
      buffer: Buffer;
      type: 'education' | 'certificate' | 'achievement';
    }[],
    tutorId: string
  ): Promise<{ type: string; imageUrl: string }[]> {
    try {
      const uploadPromises = files.map(async (file) => {
        let imageUrl: string;

        switch (file.type) {
          case 'education':
            imageUrl = await this.uploadEducationImage(file.buffer, tutorId);
            break;
          case 'certificate':
            imageUrl = await this.uploadCertificateImage(file.buffer, tutorId);
            break;
          case 'achievement':
            imageUrl = await this.uploadAchievementImage(file.buffer, tutorId);
            break;
          default:
            throw new Error('Loại ảnh không hợp lệ');
        }

        return { type: file.type, imageUrl };
      });

      return await Promise.all(uploadPromises);
    } catch (error: any) {
      throw new Error(`Lỗi upload nhiều ảnh: ${error.message}`);
    }
  }
}
