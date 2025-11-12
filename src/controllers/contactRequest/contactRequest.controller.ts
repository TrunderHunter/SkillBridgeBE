import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { contactRequestService } from '../../services/contactRequest/contactRequest.service';
import { logger } from '../../utils/logger';
import { ContactRequest } from '../../models/ContactRequest';
import { mapContactRequestToResponse } from '../../utils/mappers/contactRequest.mapper';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export class ContactRequestController {
  /**
   * Student creates contact request
   */
  static async createContactRequest(
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

      const studentId = req.user!.id;
      const result = await contactRequestService.createContactRequest(studentId, req.body);

      res.status(201).json(result);
    } catch (error: any) {
      logger.error('Create contact request controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể gửi yêu cầu liên hệ'
      });
    }
  }

  /**
   * Tutor creates teach request to a student's post
   */
  static async createRequestFromTutor(
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

      const tutorId = req.user!.id;
      const result = await contactRequestService.createRequestFromTutor(tutorId, req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể gửi đề nghị dạy'
      });
    }
  }

  /**
   * Get student's contact requests
   */
  static async getStudentRequests(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const studentId = req.user!.id;
      const filters = req.query;

      const result = await contactRequestService.getStudentRequests(studentId, filters);
      res.json(result);
    } catch (error: any) {
      logger.error('Get student requests controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy danh sách yêu cầu'
      });
    }
  }

  /**
   * Get tutor's contact requests
   */
  static async getTutorRequests(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const filters = req.query;

      const result = await contactRequestService.getTutorRequests(tutorId, filters);
      res.json(result);
    } catch (error: any) {
      logger.error('Get tutor requests controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy danh sách yêu cầu'
      });
    }
  }

  /**
   * Student responds to a tutor-initiated request
   */
  static async studentRespondToRequest(
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

      const studentId = req.user!.id;
      const requestId = req.params.requestId;
      const result = await contactRequestService.studentRespondToRequest(
        studentId,
        requestId,
        req.body
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể phản hồi đề nghị'
      });
    }
  }

  /**
   * Tutor responds to contact request
   */
  static async respondToRequest(
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

      const tutorId = req.user!.id;
      const requestId = req.params.requestId;

      const result = await contactRequestService.respondToRequest(
        tutorId,
        requestId,
        req.body
      );

      res.json(result);
    } catch (error: any) {
      logger.error('Respond to request controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể phản hồi yêu cầu'
      });
    }
  }

  /**
   * Create learning class from accepted request
   */
  static async createLearningClass(
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

      const tutorId = req.user!.id;
      const result = await contactRequestService.createLearningClass(tutorId, req.body);

      res.status(201).json(result);
    } catch (error: any) {
      logger.error('Create learning class controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể tạo lớp học'
      });
    }
  }

  /**
   * Cancel contact request (by student)
   */
  static async cancelRequest(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const studentId = req.user!.id;
      const requestId = req.params.requestId;

      const result = await contactRequestService.cancelRequest(studentId, requestId);
      res.json(result);
    } catch (error: any) {
      logger.error('Cancel request controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể hủy yêu cầu'
      });
    }
  }

  /**
   * Get contact request detail
   */
  static async getRequestDetail(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.id;
      const requestId = req.params.requestId;

      const contactRequest = await ContactRequest.findOne({
        _id: requestId,
        $or: [{ studentId: userId }, { tutorId: userId }]
      })
        .populate('studentId', 'full_name avatar_url email phone_number')
        .populate('tutorId', 'full_name avatar_url email phone_number')
        .populate('tutorPostId', 'title description pricePerSession sessionDuration')
        .populate('subject', 'name')
        .lean();

      if (!contactRequest) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy yêu cầu'
        });
      }

      // Transform to frontend format
      const transformedRequest = mapContactRequestToResponse(contactRequest);

      res.json({
        success: true,
        data: transformedRequest
      });
    } catch (error: any) {
      logger.error('Get request detail controller error:', error);
      res.status(400).json({
        success: false,
        message: 'Không thể lấy thông tin yêu cầu'
      });
    }
  }
}