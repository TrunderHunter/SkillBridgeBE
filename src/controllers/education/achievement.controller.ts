import { Request, Response, NextFunction } from 'express';
import {
  AchievementService,
  CreateAchievementData,
  UpdateAchievementData,
} from '../../services/education';
import { AchievementType, AchievementLevel } from '../../models/Achievement';
import { sendSuccess, sendError } from '../../utils/response';

export class AchievementController {
  /**
   * Create achievement record
   */
  static async createAchievement(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const {
        name,
        level,
        date_achieved,
        organization,
        type,
        field,
        description,
      } = req.body;

      const achievementData: CreateAchievementData = {
        tutor_id: tutorId,
        name,
        level: level as AchievementLevel,
        date_achieved: new Date(date_achieved),
        organization,
        type: type as AchievementType,
        field,
        description,
      };

      const achievementImageFile = req.file;

      const achievement = await AchievementService.createAchievement(
        achievementData,
        achievementImageFile
      );

      sendSuccess(res, 'Achievement created successfully', achievement, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tutor's achievements
   */
  static async getAchievements(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const achievements =
        await AchievementService.getAchievementsByTutorId(tutorId);

      sendSuccess(res, 'Achievements retrieved successfully', achievements);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get achievement by ID
   */
  static async getAchievementById(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { achievementId } = req.params;

      const achievement = await AchievementService.getAchievementById(
        achievementId,
        tutorId
      );

      if (!achievement) {
        return sendError(res, 'Achievement not found', undefined, 404);
      }

      sendSuccess(res, 'Achievement retrieved successfully', achievement);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update achievement record
   */
  static async updateAchievement(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { achievementId } = req.params;
      const {
        name,
        level,
        date_achieved,
        organization,
        type,
        field,
        description,
      } = req.body;

      const updateData: UpdateAchievementData = {};

      if (name) updateData.name = name;
      if (level) updateData.level = level as AchievementLevel;
      if (date_achieved) updateData.date_achieved = new Date(date_achieved);
      if (organization) updateData.organization = organization;
      if (type) updateData.type = type as AchievementType;
      if (field) updateData.field = field;
      if (description) updateData.description = description;

      const achievementImageFile = req.file;

      const achievement = await AchievementService.updateAchievement(
        achievementId,
        tutorId,
        updateData,
        achievementImageFile
      );

      sendSuccess(res, 'Achievement updated successfully', achievement);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete achievement record
   */
  static async deleteAchievement(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { achievementId } = req.params;

      await AchievementService.deleteAchievement(achievementId, tutorId);

      sendSuccess(res, 'Achievement deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available achievement types
   */
  static async getAchievementTypes(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const types = AchievementService.getAchievementTypes();
      sendSuccess(res, 'Achievement types retrieved successfully', types);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available achievement levels
   */
  static async getAchievementLevels(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const levels = AchievementService.getAchievementLevels();
      sendSuccess(res, 'Achievement levels retrieved successfully', levels);
    } catch (error) {
      next(error);
    }
  }
}
