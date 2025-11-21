import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { classService } from '../../services/class/class.service';
import { logger } from '../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export class ClassController {
  /**
   * Get tutor's classes
   */
  static async getTutorClasses(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const result = await classService.getTutorClasses(tutorId);
      res.json(result);
    } catch (error: any) {
      logger.error('Get tutor classes controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy danh sách lớp học',
      });
    }
  }

  /**
   * Get student's classes
   */
  static async getStudentClasses(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const studentId = req.user!.id;
      const result = await classService.getStudentClasses(studentId);
      res.json(result);
    } catch (error: any) {
      logger.error('Get student classes controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy danh sách lớp học',
      });
    }
  }

  /**
   * Get all student assignments
   */
  static async getStudentAssignments(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const studentId = req.user!.id;
      const result = await classService.getStudentAssignments(studentId);
      res.json(result);
    } catch (error: any) {
      logger.error('Get student assignments controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy danh sách bài tập',
      });
    }
  }

  /**
   * Get all tutor assignments
   */
  static async getTutorAssignments(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const result = await classService.getTutorAssignments(tutorId);
      res.json(result);
    } catch (error: any) {
      logger.error('Get tutor assignments controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy danh sách bài tập',
      });
    }
  }

  /**
   * Get class details by ID
   */
  static async getClassById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { classId } = req.params;
      const userId = req.user!.id;
      const result = await classService.getClassById(classId, userId);
      console.log(result);
      res.json(result);
    } catch (error: any) {
      logger.error('Get class details controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy thông tin lớp học',
      });
    }
  }

  /**
   * Update class status
   */
  static async updateClassStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { classId } = req.params;
      const { status } = req.body;
      const userId = req.user!.id;

      const result = await classService.updateClassStatus(
        classId,
        status,
        userId
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Update class status controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể cập nhật trạng thái lớp học',
      });
    }
  }

  /**
   * Add student review for class
   */
  static async addStudentReview(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { classId } = req.params;
      const studentId = req.user!.id;
      const { rating, review } = req.body;

      const result = await classService.addStudentReview(
        classId,
        studentId,
        rating,
        review
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Add student review controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể thêm đánh giá',
      });
    }
  }

  /**
   * Add tutor feedback for class
   */
  static async addTutorFeedback(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { classId } = req.params;
      const tutorId = req.user!.id;
      const { rating, feedback } = req.body;

      const result = await classService.addTutorFeedback(
        classId,
        tutorId,
        rating,
        feedback
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Add tutor feedback controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể thêm đánh giá',
      });
    }
  }

  /**
   * Get class schedule with detailed sessions
   */
  static async getClassSchedule(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { classId } = req.params;
      const userId = req.user!.id;

      const result = await classService.getClassSchedule(classId, userId);
      res.json(result);
    } catch (error: any) {
      logger.error('Get class schedule controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy lịch học',
      });
    }
  }

  /**
   * Get public tutor reviews for search pages
   */
  static async getTutorReviews(req: AuthenticatedRequest, res: Response) {
    try {
      const { tutorId } = req.params;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 10;

      const result = await classService.getTutorReviews(
        tutorId,
        Number.isNaN(page) ? 1 : page,
        Number.isNaN(limit) ? 10 : limit
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Get tutor reviews controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy danh sách đánh giá',
      });
    }
  }

  /**
   * Update session status
   */
  static async updateSessionStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { classId, sessionNumber } = req.params;
      const userId = req.user!.id;
      const { status, notes } = req.body;

      const result = await classService.updateSessionStatus(
        classId,
        parseInt(sessionNumber),
        status,
        userId,
        notes
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Update session status controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể cập nhật trạng thái buổi học',
      });
    }
  }

  /**
   * Mark attendance for session (tutor or student)
   */
  static async markAttendance(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { classId, sessionNumber } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const result = await classService.markAttendance(
        classId,
        parseInt(sessionNumber),
        userId,
        userRole
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Mark attendance controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể điểm danh',
      });
    }
  }

  /**
   * Assign homework (tutor only)
   */
  static async assignHomework(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { classId, sessionNumber } = req.params;
      const userId = req.user!.id;
      const { title, description, fileUrl, deadline } = req.body;

      const result = await classService.assignHomework(
        classId,
        parseInt(sessionNumber),
        userId,
        { title, description, fileUrl, deadline }
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Assign homework controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể giao bài tập',
      });
    }
  }

  /**
   * Submit homework (student only)
   */
  static async submitHomework(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { classId, sessionNumber } = req.params;
      const userId = req.user!.id;
      const { assignmentId, fileUrl, notes } = req.body;

      const result = await classService.submitHomework(
        classId,
        parseInt(sessionNumber),
        userId,
        { assignmentId, fileUrl, notes }
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Submit homework controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể nộp bài tập',
      });
    }
  }

  /**
   * Grade homework (tutor only)
   */
  static async gradeHomework(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { classId, sessionNumber } = req.params;
      const userId = req.user!.id;
      const { assignmentId, score, feedback } = req.body;

      const result = await classService.gradeHomework(
        classId,
        parseInt(sessionNumber),
        userId,
        { assignmentId, score, feedback }
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Grade homework controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể chấm điểm',
      });
    }
  }

  /**
   * Get weekly schedule
   */
  static async getWeeklySchedule(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { date } = req.query;

      const result = await classService.getWeeklySchedule(
        userId,
        userRole,
        date ? new Date(date as string) : new Date()
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Get weekly schedule controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy lịch học tuần',
      });
    }
  }

  /**
   * Get moderator (tutor) join link for an online class
   */
  static async getModeratorJoinLink(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { classId } = req.params;
      const userId = req.user!.id;
      const displayName = req.user?.email || 'Tutor';
      const email = req.user?.email;

      const result = await classService.getModeratorJoinLink(classId, userId, {
        displayName,
        email,
      });
      res.json(result);
    } catch (error: any) {
      logger.error('Get moderator join link controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy link quản trị',
      });
    }
  }

  /**
   * Request to cancel session (both tutor and student)
   */
  static async requestCancelSession(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { classId, sessionNumber } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { reason } = req.body;

      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp lý do huỷ buổi học',
        });
      }

      const result = await classService.requestCancelSession(
        classId,
        parseInt(sessionNumber),
        userId,
        userRole,
        reason
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Request cancel session controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể gửi yêu cầu huỷ buổi học',
      });
    }
  }

  /**
   * Respond to cancellation request (approve/reject)
   */
  static async respondToCancellationRequest(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { classId, sessionNumber } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { action } = req.body;

      if (!action || !['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Action phải là APPROVE hoặc REJECT',
        });
      }

      const result = await classService.respondToCancellationRequest(
        classId,
        parseInt(sessionNumber),
        userId,
        userRole,
        action
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Respond to cancellation request controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể phản hồi yêu cầu huỷ buổi học',
      });
    }
  }

  /**
   * Class materials & assignments
   */
  static async getClassMaterials(req: AuthenticatedRequest, res: Response) {
    try {
      const { classId } = req.params;
      const userId = req.user!.id;

      const result = await classService.getClassMaterials(classId, userId);
      res.json(result);
    } catch (error: any) {
      logger.error('Get class materials controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể tải tài liệu lớp học',
      });
    }
  }

  static async createClassMaterial(req: AuthenticatedRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { classId } = req.params;
      const tutorId = req.user!.id;

      const result = await classService.addClassMaterial(
        classId,
        tutorId,
        req.body
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Create class material controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể thêm tài liệu',
      });
    }
  }

  static async updateClassMaterial(req: AuthenticatedRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { classId, materialId } = req.params;
      const tutorId = req.user!.id;

      const result = await classService.updateClassMaterial(
        classId,
        materialId,
        tutorId,
        req.body
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Update class material controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể cập nhật tài liệu',
      });
    }
  }

  static async deleteClassMaterial(req: AuthenticatedRequest, res: Response) {
    try {
      const { classId, materialId } = req.params;
      const tutorId = req.user!.id;

      const result = await classService.deleteClassMaterial(
        classId,
        materialId,
        tutorId
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Delete class material controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể xoá tài liệu',
      });
    }
  }

  static async getClassAssignments(req: AuthenticatedRequest, res: Response) {
    try {
      const { classId } = req.params;
      const userId = req.user!.id;

      const result = await classService.getClassAssignments(classId, userId);
      res.json(result);
    } catch (error: any) {
      logger.error('Get class assignments controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể tải danh sách bài tập',
      });
    }
  }

  static async createClassAssignment(req: AuthenticatedRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { classId } = req.params;
      const tutorId = req.user!.id;

      const result = await classService.createClassAssignment(
        classId,
        tutorId,
        req.body
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Create class assignment controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể tạo bài tập',
      });
    }
  }

  static async updateClassAssignment(req: AuthenticatedRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { classId, assignmentId } = req.params;
      const tutorId = req.user!.id;

      const result = await classService.updateClassAssignment(
        classId,
        assignmentId,
        tutorId,
        req.body
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Update class assignment controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể cập nhật bài tập',
      });
    }
  }

  static async deleteClassAssignment(req: AuthenticatedRequest, res: Response) {
    try {
      const { classId, assignmentId } = req.params;
      const tutorId = req.user!.id;

      const result = await classService.deleteClassAssignment(
        classId,
        assignmentId,
        tutorId
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Delete class assignment controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể xoá bài tập',
      });
    }
  }

  static async submitAssignmentWork(req: AuthenticatedRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { classId, assignmentId } = req.params;
      const studentId = req.user!.id;

      const result = await classService.submitAssignmentWork(
        classId,
        assignmentId,
        studentId,
        req.body
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Submit assignment work controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể nộp bài',
      });
    }
  }
}
