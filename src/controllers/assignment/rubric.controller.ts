import { Request, Response, NextFunction } from 'express';
import { rubricService } from '../../services/assignment/rubric.service';
import { logger } from '../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export class RubricController {
  static async listRubrics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { subjectId } = req.query;

      const result = await rubricService.listRubrics(
        tutorId,
        subjectId as string | undefined
      );
      res.json(result);
    } catch (error: any) {
      logger.error('List rubrics error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể tải danh sách rubric',
      });
    }
  }

  static async getRubric(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { rubricId } = req.params;

      const result = await rubricService.getRubric(tutorId, rubricId);
      res.json(result);
    } catch (error: any) {
      logger.error('Get rubric error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy thông tin rubric',
      });
    }
  }

  static async createRubric(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const payload = req.body;

      console.log('🔍 [DEBUG] RubricController.createRubric - tutorId:', tutorId);
      console.log('🔍 [DEBUG] RubricController.createRubric - payload:', JSON.stringify(payload, null, 2));

      const result = await rubricService.createRubric(tutorId, payload);
      
      console.log('🔍 [DEBUG] RubricController.createRubric - result:', result);
      
      res.status(201).json(result);
    } catch (error: any) {
      console.error('🔍 [DEBUG] RubricController.createRubric - error:', error);
      logger.error('Create rubric error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể tạo rubric',
      });
    }
  }

  static async updateRubric(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { rubricId } = req.params;
      const payload = req.body;

      const result = await rubricService.updateRubric(
        tutorId,
        rubricId,
        payload
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Update rubric error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể cập nhật rubric',
      });
    }
  }

  static async deleteRubric(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const { rubricId } = req.params;

      const result = await rubricService.deleteRubric(tutorId, rubricId);
      res.json(result);
    } catch (error: any) {
      logger.error('Delete rubric error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể xóa rubric',
      });
    }
  }
}


