import {
  Achievement,
  IAchievementDocument,
  AchievementType,
  AchievementLevel,
} from '../../models/Achievement';
import { FileUploadService, UploadFolder } from './fileUpload.service';
import { ApiError } from '../../utils/response';

export interface CreateAchievementData {
  tutor_id: string;
  name: string;
  level: AchievementLevel;
  date_achieved: Date;
  organization: string;
  type: AchievementType;
  field: string;
  description: string;
}

export interface UpdateAchievementData {
  name?: string;
  level?: AchievementLevel;
  date_achieved?: Date;
  organization?: string;
  type?: AchievementType;
  field?: string;
  description?: string;
}

export class AchievementService {
  /**
   * Create new achievement record
   */
  static async createAchievement(
    data: CreateAchievementData,
    achievementImageFile?: Express.Multer.File
  ): Promise<IAchievementDocument> {
    let achievementImageUrl: string | undefined;
    let achievementImagePublicId: string | undefined;

    try {
      // Upload achievement image if provided
      if (achievementImageFile) {
        const validation = FileUploadService.validateFile(achievementImageFile);
        if (!validation.valid) {
          throw new ApiError(400, validation.error!);
        }

        const uploadResult = await FileUploadService.uploadEducationImage(
          achievementImageFile.buffer,
          UploadFolder.ACHIEVEMENTS,
          data.tutor_id,
          achievementImageFile.originalname
        );

        achievementImageUrl = uploadResult.url;
        achievementImagePublicId = uploadResult.public_id;
      }

      // Create achievement record
      const achievement = new Achievement({
        ...data,
        achievement_image_url: achievementImageUrl,
        achievement_image_public_id: achievementImagePublicId,
      });

      return await achievement.save();
    } catch (error) {
      // Clean up uploaded image if achievement creation fails
      if (achievementImagePublicId) {
        await FileUploadService.deleteImage(achievementImagePublicId);
      }
      throw error;
    }
  }

  /**
   * Get achievements by tutor ID
   */
  static async getAchievementsByTutorId(
    tutorId: string
  ): Promise<IAchievementDocument[]> {
    return await Achievement.find({ tutor_id: tutorId }).sort({
      date_achieved: -1,
      created_at: -1,
    });
  }

  /**
   * Get achievement by ID and tutor ID
   */
  static async getAchievementById(
    achievementId: string,
    tutorId: string
  ): Promise<IAchievementDocument | null> {
    return await Achievement.findOne({ _id: achievementId, tutor_id: tutorId });
  }

  /**
   * Update achievement record
   */
  static async updateAchievement(
    achievementId: string,
    tutorId: string,
    data: UpdateAchievementData,
    achievementImageFile?: Express.Multer.File
  ): Promise<IAchievementDocument> {
    let newAchievementImageUrl: string | undefined;
    let newAchievementImagePublicId: string | undefined;

    try {
      const achievement = await Achievement.findOne({
        _id: achievementId,
        tutor_id: tutorId,
      });
      if (!achievement) {
        throw new ApiError(404, 'Achievement not found');
      }

      const oldAchievementImagePublicId =
        achievement.achievement_image_public_id;

      // Handle new achievement image upload
      if (achievementImageFile) {
        const validation = FileUploadService.validateFile(achievementImageFile);
        if (!validation.valid) {
          throw new ApiError(400, validation.error!);
        }

        const uploadResult = await FileUploadService.uploadEducationImage(
          achievementImageFile.buffer,
          UploadFolder.ACHIEVEMENTS,
          tutorId,
          achievementImageFile.originalname
        );

        newAchievementImageUrl = uploadResult.url;
        newAchievementImagePublicId = uploadResult.public_id;
      }

      // Update achievement record
      Object.assign(achievement, data);
      if (newAchievementImageUrl) {
        achievement.achievement_image_url = newAchievementImageUrl;
        achievement.achievement_image_public_id = newAchievementImagePublicId;
      }

      const updatedAchievement = await achievement.save();

      // Delete old image if new one was uploaded successfully
      if (oldAchievementImagePublicId && newAchievementImagePublicId) {
        await FileUploadService.deleteImage(oldAchievementImagePublicId);
      }

      return updatedAchievement;
    } catch (error) {
      // Clean up new image if update fails
      if (newAchievementImagePublicId) {
        await FileUploadService.deleteImage(newAchievementImagePublicId);
      }
      throw error;
    }
  }

  /**
   * Delete achievement record
   */
  static async deleteAchievement(
    achievementId: string,
    tutorId: string
  ): Promise<void> {
    const achievement = await Achievement.findOne({
      _id: achievementId,
      tutor_id: tutorId,
    });
    if (!achievement) {
      throw new ApiError(404, 'Achievement not found');
    }

    // Delete associated image
    if (achievement.achievement_image_public_id) {
      await FileUploadService.deleteImage(
        achievement.achievement_image_public_id
      );
    }

    await Achievement.deleteOne({ _id: achievementId, tutor_id: tutorId });
  }

  /**
   * Get achievement count for tutor
   */
  static async getTutorAchievementCount(tutorId: string): Promise<number> {
    return await Achievement.countDocuments({ tutor_id: tutorId });
  }

  /**
   * Get available achievement types and levels
   */
  static getAchievementTypes(): AchievementType[] {
    return Object.values(AchievementType);
  }

  static getAchievementLevels(): AchievementLevel[] {
    return Object.values(AchievementLevel);
  }
}
