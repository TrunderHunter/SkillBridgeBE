import { v2 as cloudinary } from 'cloudinary';

export enum UploadFolder {
  EDUCATION_DEGREES = 'education/degrees',
  CERTIFICATES = 'education/certificates',
  ACHIEVEMENTS = 'education/achievements',
}

export interface UploadResult {
  url: string;
  public_id: string;
}

export class FileUploadService {
  /**
   * Upload and optimize image for education documents
   */
  static async uploadEducationImage(
    buffer: Buffer,
    folder: UploadFolder,
    userId: string,
    originalName?: string
  ): Promise<UploadResult> {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${userId}_${timestamp}_${originalName?.replace(/[^a-zA-Z0-9.]/g, '_') || 'document'}`;

      return new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: folder,
              public_id: filename,
              allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
              transformation: [
                {
                  width: 1500,
                  height: 1500,
                  crop: 'limit',
                  quality: 'auto:good',
                  format: 'auto',
                  flags: 'progressive',
                },
              ],
              resource_type: 'auto', // Auto-detect resource type
            },
            (error, result) => {
              if (error) {
                reject(new Error(`Upload failed: ${error.message}`));
              } else if (result) {
                resolve({
                  url: result.secure_url,
                  public_id: result.public_id,
                });
              } else {
                reject(new Error('Upload failed: No result returned'));
              }
            }
          )
          .end(buffer);
      });
    } catch (error) {
      throw new Error(
        `File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete image from Cloudinary
   */
  static async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === 'ok';
    } catch (error) {
      console.error('Failed to delete image:', error);
      return false;
    }
  }

  /**
   * Generate secure URL with expiration
   */
  static generateSecureUrl(
    publicId: string,
    expiresInHours: number = 24
  ): string {
    const expirationTimestamp =
      Math.floor(Date.now() / 1000) + expiresInHours * 3600;

    return cloudinary.utils.private_download_url(publicId, 'jpg', {
      expires_at: expirationTimestamp,
    });
  }

  /**
   * Validate file type and size
   */
  static validateFile(file: Express.Multer.File): {
    valid: boolean;
    error?: string;
  } {
    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return { valid: false, error: 'File size must be less than 5MB' };
    }

    // Check file type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: 'Only JPG, PNG, WEBP and PDF files are allowed',
      };
    }

    return { valid: true };
  }

  /**
   * Clean up unused files (called when update/delete operations fail)
   */
  static async cleanupUnusedFiles(publicIds: string[]): Promise<void> {
    for (const publicId of publicIds) {
      await this.deleteImage(publicId);
    }
  }
}
