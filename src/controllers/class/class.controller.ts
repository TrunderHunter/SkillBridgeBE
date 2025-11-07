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
}