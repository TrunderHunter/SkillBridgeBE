import { Request, Response, NextFunction } from 'express';
import { exerciseTemplateService } from '../../services/assignment/exerciseTemplate.service';
import { logger } from '../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export class ExerciseTemplateController {
  static async listTemplates(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { subjectId, gradeLevel, type, search, mineOnly } = req.query;

      const result = await exerciseTemplateService.listTemplates(tutorId, {
        subjectId: subjectId as string | undefined,
        gradeLevel: gradeLevel as string | undefined,
        type: type as string | undefined,
        search: search as string | undefined,
        mineOnly: mineOnly === 'true',
      });

      res.json(result);
    } catch (error: any) {
      logger.error('List exercise templates error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể tải danh sách bài tập mẫu',
      });
    }
  }

  static async getTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { templateId } = req.params;

      const result = await exerciseTemplateService.getTemplate(
        tutorId,
        templateId
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Get exercise template error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy thông tin bài tập mẫu',
      });
    }
  }

  static async createTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const payload = req.body;

      const result = await exerciseTemplateService.createTemplate(
        tutorId,
        payload
      );
      res.status(201).json(result);
    } catch (error: any) {
      logger.error('Create exercise template error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể tạo bài tập mẫu',
      });
    }
  }

  static async updateTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { templateId } = req.params;
      const payload = req.body;

      const result = await exerciseTemplateService.updateTemplate(
        tutorId,
        templateId,
        payload
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Update exercise template error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể cập nhật bài tập mẫu',
      });
    }
  }

  static async deleteTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { templateId } = req.params;

      const result = await exerciseTemplateService.deleteTemplate(
        tutorId,
        templateId
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Delete exercise template error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể xóa bài tập mẫu',
      });
    }
  }
}


