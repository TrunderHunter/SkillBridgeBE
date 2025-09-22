import { Certificate, ICertificateDocument } from '../../models/Certificate';
import { FileUploadService, UploadFolder } from './fileUpload.service';
import { ApiError } from '../../utils/response';

export interface CreateCertificateData {
  tutor_id: string;
  name: string;
  description: string;
  issued_by: string;
  issue_date?: Date;
  expiry_date?: Date;
}

export interface UpdateCertificateData {
  name?: string;
  description?: string;
  issued_by?: string;
  issue_date?: Date;
  expiry_date?: Date;
}

export class CertificateService {
  /**
   * Create new certificate record
   */
  static async createCertificate(
    data: CreateCertificateData,
    certificateImageFile?: Express.Multer.File
  ): Promise<ICertificateDocument> {
    let certificateImageUrl: string | undefined;
    let certificateImagePublicId: string | undefined;

    try {
      // Upload certificate image if provided
      if (certificateImageFile) {
        const validation = FileUploadService.validateFile(certificateImageFile);
        if (!validation.valid) {
          throw new ApiError(400, validation.error!);
        }

        const uploadResult = await FileUploadService.uploadEducationImage(
          certificateImageFile.buffer,
          UploadFolder.CERTIFICATES,
          data.tutor_id,
          certificateImageFile.originalname
        );

        certificateImageUrl = uploadResult.url;
        certificateImagePublicId = uploadResult.public_id;
      }

      // Create certificate record
      const certificate = new Certificate({
        ...data,
        certificate_image_url: certificateImageUrl,
        certificate_image_public_id: certificateImagePublicId,
      });

      return await certificate.save();
    } catch (error) {
      // Clean up uploaded image if certificate creation fails
      if (certificateImagePublicId) {
        await FileUploadService.deleteImage(certificateImagePublicId);
      }
      throw error;
    }
  }

  /**
   * Get certificates by tutor ID
   */
  static async getCertificatesByTutorId(
    tutorId: string
  ): Promise<ICertificateDocument[]> {
    return await Certificate.find({ tutor_id: tutorId }).sort({
      created_at: -1,
    });
  }

  /**
   * Get certificate by ID and tutor ID
   */
  static async getCertificateById(
    certificateId: string,
    tutorId: string
  ): Promise<ICertificateDocument | null> {
    return await Certificate.findOne({ _id: certificateId, tutor_id: tutorId });
  }

  /**
   * Update certificate record
   */
  static async updateCertificate(
    certificateId: string,
    tutorId: string,
    data: UpdateCertificateData,
    certificateImageFile?: Express.Multer.File
  ): Promise<ICertificateDocument> {
    let newCertificateImageUrl: string | undefined;
    let newCertificateImagePublicId: string | undefined;

    try {
      const certificate = await Certificate.findOne({
        _id: certificateId,
        tutor_id: tutorId,
      });
      if (!certificate) {
        throw new ApiError(404, 'Certificate not found');
      }

      const oldCertificateImagePublicId =
        certificate.certificate_image_public_id;

      // Handle new certificate image upload
      if (certificateImageFile) {
        const validation = FileUploadService.validateFile(certificateImageFile);
        if (!validation.valid) {
          throw new ApiError(400, validation.error!);
        }

        const uploadResult = await FileUploadService.uploadEducationImage(
          certificateImageFile.buffer,
          UploadFolder.CERTIFICATES,
          tutorId,
          certificateImageFile.originalname
        );

        newCertificateImageUrl = uploadResult.url;
        newCertificateImagePublicId = uploadResult.public_id;
      }

      // Update certificate record
      Object.assign(certificate, data);
      if (newCertificateImageUrl) {
        certificate.certificate_image_url = newCertificateImageUrl;
        certificate.certificate_image_public_id = newCertificateImagePublicId;
      }

      const updatedCertificate = await certificate.save();

      // Delete old image if new one was uploaded successfully
      if (oldCertificateImagePublicId && newCertificateImagePublicId) {
        await FileUploadService.deleteImage(oldCertificateImagePublicId);
      }

      return updatedCertificate;
    } catch (error) {
      // Clean up new image if update fails
      if (newCertificateImagePublicId) {
        await FileUploadService.deleteImage(newCertificateImagePublicId);
      }
      throw error;
    }
  }

  /**
   * Delete certificate record
   */
  static async deleteCertificate(
    certificateId: string,
    tutorId: string
  ): Promise<void> {
    const certificate = await Certificate.findOne({
      _id: certificateId,
      tutor_id: tutorId,
    });
    if (!certificate) {
      throw new ApiError(404, 'Certificate not found');
    }

    // Delete associated image
    if (certificate.certificate_image_public_id) {
      await FileUploadService.deleteImage(
        certificate.certificate_image_public_id
      );
    }

    await Certificate.deleteOne({ _id: certificateId, tutor_id: tutorId });
  }

  /**
   * Get certificate count for tutor (for verification eligibility)
   */
  static async getTutorCertificateCount(tutorId: string): Promise<number> {
    return await Certificate.countDocuments({ tutor_id: tutorId });
  }

  /**
   * Check if tutor has certificates (for verification eligibility)
   */
  static async hasTutorCertificates(tutorId: string): Promise<boolean> {
    const count = await this.getTutorCertificateCount(tutorId);
    return count > 0;
  }
}
