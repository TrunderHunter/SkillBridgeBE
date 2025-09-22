import { Request, Response, NextFunction } from 'express';
import {
  EducationService,
  CreateEducationData,
  UpdateEducationData,
} from '../../services/education';
import { EducationLevel } from '../../models/Education';
import { sendSuccess, sendError } from '../../utils/response';

export class EducationController {
  /**
   * Create education record
   */
  static async createEducation(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { level, school, major, start_year, end_year } = req.body;

      const educationData: CreateEducationData = {
        tutor_id: tutorId,
        level: level as EducationLevel,
        school,
        major,
        start_year,
        end_year,
      };

      const degreeImageFile = req.file;

      const education = await EducationService.createEducation(
        educationData,
        degreeImageFile
      );

      sendSuccess(res, 'Education record created successfully', education, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tutor's education
   */
  static async getEducation(req: Request, res: Response, next: NextFunction) {
    try {
      const tutorId = req.user!.id;
      const education = await EducationService.getEducationByTutorId(tutorId);

      if (!education) {
        return sendError(res, 'Education record not found', undefined, 404);
      }

      sendSuccess(res, 'Education record retrieved successfully', education);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update education record
   */
  static async updateEducation(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { educationId } = req.params;
      const { level, school, major, start_year, end_year } = req.body;

      const updateData: UpdateEducationData = {};

      if (level) updateData.level = level as EducationLevel;
      if (school) updateData.school = school;
      if (major !== undefined) updateData.major = major;
      if (start_year) updateData.start_year = start_year;
      if (end_year) updateData.end_year = end_year;

      const degreeImageFile = req.file;

      const education = await EducationService.updateEducation(
        educationId,
        tutorId,
        updateData,
        degreeImageFile
      );

      sendSuccess(res, 'Education record updated successfully', education);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete education record
   */
  static async deleteEducation(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { educationId } = req.params;

      await EducationService.deleteEducation(educationId, tutorId);

      sendSuccess(res, 'Education record deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available education levels
   */
  static async getEducationLevels(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const levels = EducationService.getEducationLevels();
      sendSuccess(res, 'Education levels retrieved successfully', levels);
    } catch (error) {
      next(error);
    }
  }
}
