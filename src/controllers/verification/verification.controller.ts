import { Request, Response, NextFunction } from 'express';
import { VerificationService } from '../../services/verification';
import { sendSuccess, sendError } from '../../utils/response';

export class VerificationController {
  /**
   * Create verification request - automatically collect tutor's current data
   */
  static async createVerificationRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;

      // Automatically collect all current data from tutor's education, certificates, and achievements
      const tutorData =
        await VerificationService.collectTutorDataForVerification(tutorId);

      // Validate that tutor has required minimum data
      if (!tutorData.education_id && tutorData.certificate_ids.length === 0) {
        return sendError(
          res,
          'Để yêu cầu xác thực, bạn cần có ít nhất thông tin học vấn và một chứng chỉ',
          undefined,
          400
        );
      }

      // Create verification request
      const verificationRequest =
        await VerificationService.createVerificationRequest(tutorData);

      sendSuccess(
        res,
        'Yêu cầu xác thực đã được gửi thành công. Admin sẽ xem xét và phản hồi sớm nhất có thể.',
        verificationRequest,
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current verification status
   */
  static async getVerificationStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const status = await VerificationService.getVerificationStatus(tutorId);

      if (!status) {
        return sendSuccess(res, 'Chưa có yêu cầu xác thực nào', null);
      }

      sendSuccess(res, 'Lấy trạng thái xác thực thành công', status);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get verification history
   */
  static async getVerificationHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tutorId = req.user!.id;
      const history = await VerificationService.getVerificationHistory(tutorId);

      sendSuccess(res, 'Lấy lịch sử xác thực thành công', history);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all pending verification requests (Admin only)
   */
  static async getPendingRequests(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const requests =
        await VerificationService.getPendingVerificationRequests();

      sendSuccess(res, 'Lấy danh sách yêu cầu xác thực thành công', requests);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve verification request (Admin only)
   */
  static async approveVerificationRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const adminId = req.user!.id;
      const { requestId } = req.params;
      const { feedback } = req.body;

      const approvedRequest =
        await VerificationService.approveVerificationRequest(
          requestId,
          adminId,
          feedback
        );

      sendSuccess(res, 'Yêu cầu xác thực đã được phê duyệt', approvedRequest);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reject verification request (Admin only)
   */
  static async rejectVerificationRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const adminId = req.user!.id;
      const { requestId } = req.params;
      const { feedback } = req.body;

      if (!feedback || feedback.trim().length === 0) {
        return sendError(
          res,
          'Vui lòng cung cấp lý do từ chối',
          undefined,
          400
        );
      }

      const rejectedRequest =
        await VerificationService.rejectVerificationRequest(
          requestId,
          adminId,
          feedback
        );

      sendSuccess(res, 'Yêu cầu xác thực đã được từ chối', rejectedRequest);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get verification request details (Admin only)
   */
  static async getVerificationRequestDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { requestId } = req.params;

      const request =
        await VerificationService.getVerificationRequestById(requestId);

      if (!request) {
        return sendError(
          res,
          'Không tìm thấy yêu cầu xác thực',
          undefined,
          404
        );
      }

      sendSuccess(res, 'Lấy chi tiết yêu cầu xác thực thành công', request);
    } catch (error) {
      next(error);
    }
  }
}
