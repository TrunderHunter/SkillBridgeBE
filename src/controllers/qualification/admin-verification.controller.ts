import { Request, Response } from 'express';
import { AdminVerificationService } from '../../services/qualification';
import {
  RequestStatus,
  VerificationStatus,
} from '../../types/verification.types';
import { VerificationTargetType } from '../../models/VerificationDetail';
import { sendSuccess, sendError } from '../../utils';

export class AdminVerificationController {
  /**
   * GET /api/admin/verification-requests - Danh sách yêu cầu xác thực với filter
   */
  static async getVerificationRequests(req: Request, res: Response) {
    try {
      const { status, tutorId, page, limit } = req.query;

      const filters: any = {};
      if (status) filters.status = status as RequestStatus;
      if (tutorId) filters.tutorId = tutorId as string;
      if (page) filters.page = Number(page);
      if (limit) filters.limit = Number(limit);

      const result =
        await AdminVerificationService.getVerificationRequests(filters);

      return sendSuccess(
        res,
        'Lấy danh sách yêu cầu xác thực thành công',
        result
      );
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * GET /api/admin/verification-requests/:id - Chi tiết một yêu cầu xác thực
   */
  static async getVerificationRequestDetail(req: Request, res: Response) {
    try {
      const requestId = req.params.id;

      const result =
        await AdminVerificationService.getVerificationRequestDetailForAdmin(
          requestId
        );

      return sendSuccess(
        res,
        'Lấy chi tiết yêu cầu xác thực thành công',
        result
      );
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * GET /api/admin/verification-requests/:id/user-info - Lấy thông tin User và TutorProfile
   */
  static async getUserAndTutorProfileInfo(req: Request, res: Response) {
    try {
      const tutorId = req.params.tutorId;

      const result =
        await AdminVerificationService.getUserAndTutorProfileInfo(tutorId);

      return sendSuccess(
        res,
        'Lấy thông tin người dùng và gia sư thành công',
        result
      );
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * PUT /api/admin/verification-requests/:id - Xử lý yêu cầu (chấp nhận/từ chối từng mục)
   */
  static async processVerificationRequest(req: Request, res: Response) {
    try {
      const requestId = req.params.id;
      const adminId = req.user!.id;
      const { decisions, adminNote } = req.body;

      // Validate decisions
      if (!Array.isArray(decisions) || decisions.length === 0) {
        return sendError(
          res,
          'Phải có ít nhất một quyết định xử lý',
          undefined,
          400
        );
      }

      // Validate each decision
      for (const decision of decisions) {
        if (!decision.detailId || !decision.status) {
          return sendError(
            res,
            'Mỗi quyết định phải có detailId và status',
            undefined,
            400
          );
        }

        if (
          ![VerificationStatus.VERIFIED, VerificationStatus.REJECTED].includes(
            decision.status
          )
        ) {
          return sendError(
            res,
            'Status chỉ có thể là VERIFIED hoặc REJECTED',
            undefined,
            400
          );
        }

        if (
          decision.status === VerificationStatus.REJECTED &&
          !decision.rejectionReason
        ) {
          return sendError(
            res,
            'Phải có lý do từ chối khi từ chối một mục',
            undefined,
            400
          );
        }
      }

      // Process decisions
      const processedDecisions = decisions.map((d: any) => ({
        detailId: d.detailId,
        status: d.status,
        rejectionReason: d.rejectionReason,
      }));

      const result = await AdminVerificationService.processVerificationRequest(
        requestId,
        adminId,
        processedDecisions,
        adminNote
      );

      return sendSuccess(res, 'Xử lý yêu cầu xác thực thành công', result);
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * GET /api/admin/verification-history - Lịch sử xác thực
   */
  static async getVerificationHistory(req: Request, res: Response) {
    try {
      const { tutorId, targetType, page, limit } = req.query;

      const filters: any = {};
      if (tutorId) filters.tutorId = tutorId as string;
      if (targetType) filters.targetType = targetType as VerificationTargetType;
      if (page) filters.page = Number(page);
      if (limit) filters.limit = Number(limit);

      const result =
        await AdminVerificationService.getVerificationHistory(filters);

      return sendSuccess(res, 'Lấy lịch sử xác thực thành công', result);
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * GET /api/admin/verification-stats - Thống kê xác thực (bonus endpoint)
   */
  static async getVerificationStats(req: Request, res: Response) {
    try {
      // Có thể thêm logic thống kê ở đây nếu cần
      const stats = {
        pending: 0,
        approved: 0,
        rejected: 0,
        partiallyApproved: 0,
      };

      return sendSuccess(res, 'Lấy thống kê xác thực thành công', stats);
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }
}
