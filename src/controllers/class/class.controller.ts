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
        message: error.message || 'Không thể lấy danh sách lớp học'
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
        message: error.message || 'Không thể lấy danh sách lớp học'
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
      console.log(`>>> check user id`, userId);
      const result = await classService.getClassById(classId, userId);
      console.log(result);
      res.json(result);
    } catch (error: any) {
      logger.error('Get class details controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy thông tin lớp học'
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
          errors: errors.array()
        });
      }

      const { classId } = req.params;
      const { status } = req.body;
      const userId = req.user!.id;
      
      const result = await classService.updateClassStatus(classId, status, userId);
      res.json(result);
    } catch (error: any) {
      logger.error('Update class status controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể cập nhật trạng thái lớp học'
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
          errors: errors.array()
        });
      }

      const { classId } = req.params;
      const studentId = req.user!.id;
      const { rating, review } = req.body;
      
      const result = await classService.addStudentReview(classId, studentId, rating, review);
      res.json(result);
    } catch (error: any) {
      logger.error('Add student review controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể thêm đánh giá'
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
          errors: errors.array()
        });
      }

      const { classId } = req.params;
      const tutorId = req.user!.id;
      const { rating, feedback } = req.body;
      
      const result = await classService.addTutorFeedback(classId, tutorId, rating, feedback);
      res.json(result);
    } catch (error: any) {
      logger.error('Add tutor feedback controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể thêm đánh giá'
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
        message: error.message || 'Không thể lấy lịch học'
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
          errors: errors.array()
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
        message: error.message || 'Không thể cập nhật trạng thái buổi học'
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
        message: error.message || 'Không thể điểm danh'
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
          errors: errors.array()
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
        message: error.message || 'Không thể giao bài tập'
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
          errors: errors.array()
        });
      }

      const { classId, sessionNumber } = req.params;
      const userId = req.user!.id;
      const { fileUrl, notes } = req.body;
      
      const result = await classService.submitHomework(
        classId,
        parseInt(sessionNumber),
        userId,
        { fileUrl, notes }
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Submit homework controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể nộp bài tập'
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
          errors: errors.array()
        });
      }

      const { classId, sessionNumber } = req.params;
      const userId = req.user!.id;
      const { score, feedback } = req.body;
      
      const result = await classService.gradeHomework(
        classId,
        parseInt(sessionNumber),
        userId,
        { score, feedback }
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Grade homework controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể chấm điểm'
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
        message: error.message || 'Không thể lấy lịch học tuần'
      });
    }
  }

  /**
   * Cancel session (tutor only)
   */
  static async cancelSession(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { classId, sessionNumber } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { reason } = req.body;
      
      const result = await classService.cancelSession(
        classId,
        parseInt(sessionNumber),
        userId,
        userRole,
        reason
      );
      res.json(result);
    } catch (error: any) {
      logger.error('Cancel session controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể huỷ buổi học'
      });
    }
  }
}