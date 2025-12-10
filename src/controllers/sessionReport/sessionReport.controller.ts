import { Request, Response, NextFunction } from 'express';
import { sessionReportService } from '../../services/sessionReport';
import { logger } from '../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export class SessionReportController {
  /**
   * Create a new session report (Student or Tutor)
   */
  static async createReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role as 'STUDENT' | 'TUTOR';

      const { classId, sessionNumber, description, priority } = req.body;

      // Get evidence files if uploaded
      const evidenceFiles = req.files as Express.Multer.File[] | undefined;

      const report = await sessionReportService.createReport(
        {
          classId,
          sessionNumber: parseInt(sessionNumber),
          description,
          priority,
        },
        userId,
        userRole,
        evidenceFiles
      );

      res.status(201).json({
        success: true,
        message: 'Báo cáo đã được tạo thành công',
        data: report,
      });
    } catch (error: any) {
      logger.error('Create session report controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể tạo báo cáo',
      });
    }
  }

  /**
   * Get my reports (Student or Tutor)
   */
  static async getMyReports(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role as 'STUDENT' | 'TUTOR';

      const filters = {
        status: req.query.status as any,
        priority: req.query.priority as any,
        classId: req.query.classId as string,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit
          ? parseInt(req.query.limit as string)
          : undefined,
      };

      const result = await sessionReportService.getMyReports(
        userId,
        userRole,
        filters
      );

      res.json({
        success: true,
        message: 'Lấy danh sách báo cáo thành công',
        data: result,
      });
    } catch (error: any) {
      logger.error('Get my reports controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy danh sách báo cáo',
      });
    }
  }

  /**
   * Get report details (Student, Tutor, or Admin)
   */
  static async getReportById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { reportId } = req.params;

      const report = await sessionReportService.getReportById(
        reportId,
        userId,
        userRole
      );

      res.json({
        success: true,
        message: 'Lấy thông tin báo cáo thành công',
        data: report,
      });
    } catch (error: any) {
      logger.error('Get report by ID controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy thông tin báo cáo',
      });
    }
  }

  /**
   * Upload additional evidence (Student or Tutor)
   */
  static async uploadAdditionalEvidence(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.id;
      const { reportId } = req.params;

      const evidenceFiles = req.files as Express.Multer.File[];

      if (!evidenceFiles || evidenceFiles.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng tải lên ít nhất 1 tệp bằng chứng',
        });
      }

      const report = await sessionReportService.uploadAdditionalEvidence(
        reportId,
        userId,
        evidenceFiles
      );

      res.json({
        success: true,
        message: 'Thêm bằng chứng thành công',
        data: report,
      });
    } catch (error: any) {
      logger.error('Upload additional evidence controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể thêm bằng chứng',
      });
    }
  }

  /**
   * Get all reports (Admin only)
   */
  static async getAllReports(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const filters = {
        status: req.query.status as any,
        priority: req.query.priority as any,
        classId: req.query.classId as string,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit
          ? parseInt(req.query.limit as string)
          : undefined,
      };

      const result = await sessionReportService.getAllReports(filters);

      res.json({
        success: true,
        message: 'Lấy danh sách báo cáo thành công',
        data: result,
      });
    } catch (error: any) {
      logger.error('Get all reports controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy danh sách báo cáo',
      });
    }
  }

  /**
   * Update report status (Admin only)
   */
  static async updateReportStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const adminId = req.user!.id;
      const { reportId } = req.params;
      const { status } = req.body;

      const report = await sessionReportService.updateReportStatus(
        reportId,
        status,
        adminId
      );

      res.json({
        success: true,
        message: 'Cập nhật trạng thái báo cáo thành công',
        data: report,
      });
    } catch (error: any) {
      logger.error('Update report status controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể cập nhật trạng thái báo cáo',
      });
    }
  }

  /**
   * Resolve a report (Admin only)
   */
  static async resolveReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const adminId = req.user!.id;
      const { reportId } = req.params;
      const { decision, message } = req.body;

      const report = await sessionReportService.resolveReport(
        reportId,
        { decision, message },
        adminId
      );

      res.json({
        success: true,
        message: 'Giải quyết báo cáo thành công',
        data: report,
      });
    } catch (error: any) {
      logger.error('Resolve report controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể giải quyết báo cáo',
      });
    }
  }

  /**
   * Add admin note to report (Admin only)
   */
  static async addAdminNote(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const adminId = req.user!.id;
      const { reportId } = req.params;
      const { note } = req.body;

      const report = await sessionReportService.addAdminNote(
        reportId,
        note,
        adminId
      );

      res.json({
        success: true,
        message: 'Thêm ghi chú thành công',
        data: report,
      });
    } catch (error: any) {
      logger.error('Add admin note controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể thêm ghi chú',
      });
    }
  }
}
