import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { contractService } from '../../services/contract/contract.service';
import { logger } from '../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export class ContractController {
  /**
   * Create new contract from accepted contact request (tutor only)
   */
  static async createContract(
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
      const result = await contractService.createContract(tutorId, req.body);

      res.status(201).json(result);
    } catch (error: any) {
      logger.error('Create contract controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể tạo hợp đồng'
      });
    }
  }

  /**
   * Get contract by ID
   */
  static async getContractById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { contractId } = req.params;
      const userId = req.user!.id;

      const result = await contractService.getContractById(contractId, userId);
      res.json(result);
    } catch (error: any) {
      logger.error('Get contract controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy thông tin hợp đồng'
      });
    }
  }

  /**
   * Get student's contracts
   */
  static async getStudentContracts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const studentId = req.user!.id;
      const filters = req.query;

      const result = await contractService.getStudentContracts(studentId, filters);
      res.json(result);
    } catch (error: any) {
      logger.error('Get student contracts controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy danh sách hợp đồng'
      });
    }
  }

  /**
   * Get tutor's contracts
   */
  static async getTutorContracts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const filters = req.query;

      const result = await contractService.getTutorContracts(tutorId, filters);
      res.json(result);
    } catch (error: any) {
      logger.error('Get tutor contracts controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy danh sách hợp đồng'
      });
    }
  }

  /**
   * Update contract (tutor only, DRAFT status only)
   */
  static async updateContract(
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

      const { contractId } = req.params;
      const tutorId = req.user!.id;

      const result = await contractService.updateContract(contractId, tutorId, req.body);
      res.json(result);
    } catch (error: any) {
      logger.error('Update contract controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể cập nhật hợp đồng'
      });
    }
  }

  /**
   * Sign contract (both tutor and student)
   */
  static async signContract(
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

      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { contractId } = req.params;

      const signData = {
        contractId,
        signatureData: req.body.signatureData,
        ipAddress: req.ip,
      };

      const result = await contractService.signContract(userId, userRole, signData);
      res.json(result);
    } catch (error: any) {
      logger.error('Sign contract controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể ký hợp đồng'
      });
    }
  }

  /**
   * Cancel contract
   */
  static async cancelContract(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { contractId } = req.params;
      const userId = req.user!.id;
      const { reason } = req.body;

      const result = await contractService.cancelContract(contractId, userId, reason);
      res.json(result);
    } catch (error: any) {
      logger.error('Cancel contract controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể hủy hợp đồng'
      });
    }
  }

  /**
   * Get payment schedules for a contract
   */
  static async getPaymentSchedules(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { contractId } = req.params;
      const userId = req.user!.id;
      const filters = req.query;

      const result = await contractService.getPaymentSchedules(contractId, userId, filters);
      res.json(result);
    } catch (error: any) {
      logger.error('Get payment schedules controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy lịch thanh toán'
      });
    }
  }

  /**
   * Mark payment as paid (student only)
   */
  static async markPaymentPaid(
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

      const { scheduleId } = req.params;
      const studentId = req.user!.id;

      const result = await contractService.markPaymentPaid(scheduleId, studentId, req.body);
      res.json(result);
    } catch (error: any) {
      logger.error('Mark payment paid controller error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Không thể cập nhật trạng thái thanh toán'
      });
    }
  }
}
