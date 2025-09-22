import {
  Education,
  IEducationDocument,
  EducationLevel,
} from '../../models/Education';
import { FileUploadService, UploadFolder } from './fileUpload.service';
import { ApiError } from '../../utils/response';

export interface CreateEducationData {
  tutor_id: string;
  level: EducationLevel;
  school: string;
  major?: string;
  start_year: string;
  end_year: string;
}

export interface UpdateEducationData {
  level?: EducationLevel;
  school?: string;
  major?: string;
  start_year?: string;
  end_year?: string;
}

export class EducationService {
  /**
   * Create new education record
   */
  static async createEducation(
    data: CreateEducationData,
    degreeImageFile?: Express.Multer.File
  ): Promise<IEducationDocument> {
    let degreeImageUrl: string | undefined;
    let degreeImagePublicId: string | undefined;

    try {
      // Upload degree image if provided
      if (degreeImageFile) {
        const validation = FileUploadService.validateFile(degreeImageFile);
        if (!validation.valid) {
          throw new ApiError(400, validation.error!);
        }

        const uploadResult = await FileUploadService.uploadEducationImage(
          degreeImageFile.buffer,
          UploadFolder.EDUCATION_DEGREES,
          data.tutor_id,
          degreeImageFile.originalname
        );

        degreeImageUrl = uploadResult.url;
        degreeImagePublicId = uploadResult.public_id;
      }

      // Create education record
      const education = new Education({
        ...data,
        degree_image_url: degreeImageUrl,
        degree_image_public_id: degreeImagePublicId,
      });

      return await education.save();
    } catch (error) {
      // Clean up uploaded image if education creation fails
      if (degreeImagePublicId) {
        await FileUploadService.deleteImage(degreeImagePublicId);
      }
      throw error;
    }
  }

  /**
   * Get education by tutor ID
   */
  static async getEducationByTutorId(
    tutorId: string
  ): Promise<IEducationDocument | null> {
    return await Education.findOne({ tutor_id: tutorId });
  }

  /**
   * Update education record
   */
  static async updateEducation(
    educationId: string,
    tutorId: string,
    data: UpdateEducationData,
    degreeImageFile?: Express.Multer.File
  ): Promise<IEducationDocument> {
    let newDegreeImageUrl: string | undefined;
    let newDegreeImagePublicId: string | undefined;

    try {
      const education = await Education.findOne({
        _id: educationId,
        tutor_id: tutorId,
      });
      if (!education) {
        throw new ApiError(404, 'Education record not found');
      }

      const oldDegreeImagePublicId = education.degree_image_public_id;

      // Handle new degree image upload
      if (degreeImageFile) {
        const validation = FileUploadService.validateFile(degreeImageFile);
        if (!validation.valid) {
          throw new ApiError(400, validation.error!);
        }

        const uploadResult = await FileUploadService.uploadEducationImage(
          degreeImageFile.buffer,
          UploadFolder.EDUCATION_DEGREES,
          tutorId,
          degreeImageFile.originalname
        );

        newDegreeImageUrl = uploadResult.url;
        newDegreeImagePublicId = uploadResult.public_id;
      }

      // Update education record
      Object.assign(education, data);
      if (newDegreeImageUrl) {
        education.degree_image_url = newDegreeImageUrl;
        education.degree_image_public_id = newDegreeImagePublicId;
      }

      const updatedEducation = await education.save();

      // Delete old image if new one was uploaded successfully
      if (oldDegreeImagePublicId && newDegreeImagePublicId) {
        await FileUploadService.deleteImage(oldDegreeImagePublicId);
      }

      return updatedEducation;
    } catch (error) {
      // Clean up new image if update fails
      if (newDegreeImagePublicId) {
        await FileUploadService.deleteImage(newDegreeImagePublicId);
      }
      throw error;
    }
  }

  /**
   * Delete education record
   */
  static async deleteEducation(
    educationId: string,
    tutorId: string
  ): Promise<void> {
    const education = await Education.findOne({
      _id: educationId,
      tutor_id: tutorId,
    });
    if (!education) {
      throw new ApiError(404, 'Education record not found');
    }

    // Delete associated image
    if (education.degree_image_public_id) {
      await FileUploadService.deleteImage(education.degree_image_public_id);
    }

    await Education.deleteOne({ _id: educationId, tutor_id: tutorId });
  }

  /**
   * Check if tutor has education record (for verification eligibility)
   */
  static async hasTutorEducation(tutorId: string): Promise<boolean> {
    const count = await Education.countDocuments({ tutor_id: tutorId });
    return count > 0;
  }

  /**
   * Get all education levels enum values
   */
  static getEducationLevels(): EducationLevel[] {
    return Object.values(EducationLevel);
  }
}
