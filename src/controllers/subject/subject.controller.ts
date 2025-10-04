import { Request, Response } from 'express';
import {
  subjectService,
  ICreateSubjectInput,
  IUpdateSubjectInput,
} from '../../services/subject';
import { sendSuccess, sendError } from '../../utils/response';
import { logger } from '../../utils/logger';

export interface CreateSubjectRequest extends Request {
  body: ICreateSubjectInput;
}

export interface UpdateSubjectRequest extends Request {
  body: IUpdateSubjectInput;
}

export class SubjectController {
  // [ADMIN] Tạo môn học mới
  async createSubject(req: CreateSubjectRequest, res: Response) {
    try {
      const { name, description, category } = req.body;

      const subject = await subjectService.createSubject({
        name,
        description,
        category,
      });

      logger.info(`Subject created: ${subject.name} by user ${req.user?.id}`);

      return sendSuccess(res, 'Subject created successfully', { subject }, 201);
    } catch (error) {
      logger.error('Create subject error:', error);
      return sendError(
        res,
        'Failed to create subject',
        error instanceof Error ? error.message : 'Unknown error',
        400
      );
    }
  }

  // [ADMIN] Lấy danh sách tất cả môn học với phân trang
  async getAllSubjects(req: Request, res: Response) {
    try {
      const query = {
        category: req.query.category as string,
        isActive: req.query.isActive === 'false' ? false : undefined,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      };

      const result = await subjectService.getAllSubjects(query);

      return sendSuccess(res, 'Subjects retrieved successfully', result);
    } catch (error) {
      logger.error('Get all subjects error:', error);
      return sendError(res, 'Failed to retrieve subjects', undefined, 500);
    }
  }

  // [PUBLIC] Lấy danh sách môn học đang hoạt động (cho frontend)
  async getActiveSubjects(req: Request, res: Response) {
    try {
      const subjects = await subjectService.getActiveSubjects();

      return sendSuccess(res, 'Active subjects retrieved successfully', {
        subjects,
      });
    } catch (error) {
      logger.error('Get active subjects error:', error);
      return sendError(
        res,
        'Failed to retrieve active subjects',
        undefined,
        500
      );
    }
  }

  // [PUBLIC] Lấy môn học theo ID
  async getSubjectById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const subject = await subjectService.getSubjectById(id);

      if (!subject) {
        return sendError(res, 'Subject not found', undefined, 404);
      }

      return sendSuccess(res, 'Subject retrieved successfully', { subject });
    } catch (error) {
      logger.error('Get subject by ID error:', error);
      return sendError(
        res,
        'Failed to retrieve subject',
        error instanceof Error ? error.message : 'Unknown error',
        400
      );
    }
  }

  // [ADMIN] Cập nhật môn học
  async updateSubject(req: UpdateSubjectRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const subject = await subjectService.updateSubject(id, updateData);

      if (!subject) {
        return sendError(res, 'Subject not found', undefined, 404);
      }

      logger.info(`Subject updated: ${subject.name} by user ${req.user?.id}`);

      return sendSuccess(res, 'Subject updated successfully', { subject });
    } catch (error) {
      logger.error('Update subject error:', error);
      return sendError(
        res,
        'Failed to update subject',
        error instanceof Error ? error.message : 'Unknown error',
        400
      );
    }
  }

  // [ADMIN] Xóa môn học (soft delete)
  async deleteSubject(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const deleted = await subjectService.deleteSubject(id);

      if (!deleted) {
        return sendError(res, 'Subject not found', undefined, 404);
      }

      logger.info(`Subject deleted: ${id} by user ${req.user?.id}`);

      return sendSuccess(res, 'Subject deleted successfully');
    } catch (error) {
      logger.error('Delete subject error:', error);
      return sendError(
        res,
        'Failed to delete subject',
        error instanceof Error ? error.message : 'Unknown error',
        400
      );
    }
  }

  // [PUBLIC] Lấy môn học theo category
  async getSubjectsByCategory(req: Request, res: Response) {
    try {
      const { category } = req.params;
      const subjects = await subjectService.getSubjectsByCategory(category);

      return sendSuccess(res, 'Subjects by category retrieved successfully', {
        subjects,
      });
    } catch (error) {
      logger.error('Get subjects by category error:', error);
      return sendError(
        res,
        'Failed to retrieve subjects by category',
        undefined,
        500
      );
    }
  }

  // [PUBLIC] Tìm kiếm môn học
  async searchSubjects(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (!q) {
        return sendError(res, 'Search query is required', undefined, 400);
      }

      const subjects = await subjectService.searchSubjects(q as string);

      return sendSuccess(res, 'Search completed successfully', { subjects });
    } catch (error) {
      logger.error('Search subjects error:', error);
      return sendError(res, 'Failed to search subjects', undefined, 500);
    }
  }
}

export const subjectController = new SubjectController();
