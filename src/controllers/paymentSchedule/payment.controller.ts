import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { paymentScheduleService } from '../../services/paymentSchedule/paymentSchedule.service';
import { successResponse, errorResponse } from '../../utils/response';
import { logger } from '../../utils/logger';

/**
 * Payment Controller
 * Handles payment-related operations
 */
export class PaymentController {
  /**
   * Initiate payment for selected sessions
   * POST /api/v1/payments/initiate
   */
  initiatePayment = async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());
      }

      const studentId = req.user!.id;
      const { learningClassId, paymentType, sessionNumbers } = req.body;

      // Get client IP address
      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      const userAgent = req.headers['user-agent'] || 'Unknown';

      // Initiate payment
      const result = await paymentScheduleService.initiatePayment({
        learningClassId,
        studentId,
        paymentType,
        sessionNumbers,
        ipAddress,
        userAgent,
      });

      logger.info(
        `Payment initiated by student: ${studentId}, order: ${result.payment.orderId}`
      );

      return successResponse(
        res,
        'Khởi tạo thanh toán thành công',
        {
          payment: result.payment,
          paymentUrl: result.paymentUrl,
        },
        201
      );
    } catch (error: any) {
      logger.error('Error in initiatePayment controller:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  /**
   * Handle VNPay return callback
   * GET /api/v1/payments/vnpay/return
   */
  vnpayReturn = async (req: Request, res: Response) => {
    try {
      const query = req.query;

      logger.info('VNPay return callback received', {
        orderId: query.vnp_TxnRef,
      });

      // Process payment callback
      const result = await paymentScheduleService.processPaymentCallback({
        query,
      });

      if (result.success) {
        logger.info(
          `Payment callback processed successfully: ${result.payment?.orderId}`
        );

        // Redirect to payment page with success status
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const learningClassId = result.payment?.learningClassId;
        const sessionNumbers = result.payment?.sessionNumbers?.join(',') || '';

        return res.redirect(
          `${frontendUrl}/student/classes/${learningClassId}/payment?status=success&orderId=${result.payment?.orderId}&sessions=${sessionNumbers}`
        );
      } else {
        logger.warn(
          `Payment callback failed: ${query.vnp_TxnRef}, reason: ${result.message}`
        );

        // Redirect to payment page with failure status
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const learningClassId = result.payment?.learningClassId;

        return res.redirect(
          `${frontendUrl}/student/classes/${learningClassId}/payment?status=failure&orderId=${query.vnp_TxnRef}&message=${encodeURIComponent(result.message)}`
        );
      }
    } catch (error: any) {
      logger.error('Error in vnpayReturn controller:', error);

      // Redirect to error page - use generic redirect since we don't have learningClassId
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(
        `${frontendUrl}/student/dashboard?error=payment&message=${encodeURIComponent(error.message)}`
      );
    }
  };

  /**
   * Get payment status by order ID
   * GET /api/v1/payments/:orderId
   */
  getPaymentByOrderId = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());
      }

      const { orderId } = req.params;
      const userId = req.user!.id;

      const payment = await paymentScheduleService.getPaymentByOrderId(orderId);

      // Check access permission
      if (payment.studentId.id !== userId && payment.tutorId.id !== userId) {
        return errorResponse(res, 'Bạn không có quyền xem giao dịch này', 403);
      }

      return successResponse(
        res,
        'Lấy thông tin giao dịch thành công',
        payment
      );
    } catch (error: any) {
      logger.error('Error in getPaymentByOrderId controller:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  /**
   * Get available sessions for payment
   * GET /api/v1/payments/classes/:learningClassId/available-sessions
   */
  getAvailableSessions = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());
      }

      const { learningClassId } = req.params;
      const studentId = req.user!.id;

      const result =
        await paymentScheduleService.getAvailableSessionsForPayment(
          learningClassId,
          studentId
        );

      return successResponse(
        res,
        'Lấy danh sách buổi học chưa thanh toán thành công',
        result
      );
    } catch (error: any) {
      logger.error('Error in getAvailableSessions controller:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  /**
   * Get pending payment for a class (if exists)
   * GET /api/v1/payments/classes/:learningClassId/pending
   */
  getPendingPayment = async (req: Request, res: Response) => {
    try {
      const { learningClassId } = req.params;
      const studentId = req.user!.id;

      const pendingPayment = await paymentScheduleService.getPendingPayment(
        learningClassId,
        studentId
      );

      if (!pendingPayment) {
        return successResponse(res, 'Không có giao dịch đang chờ', null);
      }

      return successResponse(
        res,
        'Lấy thông tin giao dịch đang chờ thành công',
        pendingPayment
      );
    } catch (error: any) {
      logger.error('Error in getPendingPayment controller:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  /**
   * Get student's payment history
   * GET /api/v1/payments/history
   */
  getPaymentHistory = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());
      }

      const studentId = req.user!.id;
      const filters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        status: req.query.status as string,
        learningClassId: req.query.learningClassId as string,
      };

      const result = await paymentScheduleService.getStudentPaymentHistory(
        studentId,
        filters
      );

      return successResponse(res, 'Lấy lịch sử thanh toán thành công', result);
    } catch (error: any) {
      logger.error('Error in getPaymentHistory controller:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  /**
   * TEST API - Simple payment initiation without complex body
   * GET /api/v1/payments/test/create-simple
   * @access Public (for testing only)
   */
  testCreateSimplePayment = async (req: Request, res: Response) => {
    try {
      // Fixed test data - no need for complex request body
      const testData = {
        amount: 500000, // 500,000 VND
        orderId: `TEST_${Date.now()}`,
        orderInfo: 'Thanh toán test - SkillBridge',
        ipAddress: '127.0.0.1',
      };

      const vnpayService =
        require('../../services/payment/vnpay.service').vnpayService;
      const paymentUrl = await vnpayService.createPaymentUrl(testData);

      logger.info(`Test payment URL created: ${testData.orderId}`);

      return successResponse(res, 'Tạo link thanh toán test thành công', {
        orderId: testData.orderId,
        amount: testData.amount,
        paymentUrl,
        note: 'Đây là link thanh toán test. Click vào paymentUrl để thanh toán.',
      });
    } catch (error: any) {
      logger.error('Error in testCreateSimplePayment:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  /**
   * Force reprocess a payment (useful for fixing stuck payments)
   * POST /api/v1/payments/:orderId/reprocess
   * @access Admin/Student (owner only)
   */
  reprocessPayment = async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      const userId = req.user!.id;

      // Find payment
      const Payment = require('../../models/Payment').default;
      const payment = await Payment.findOne({ orderId });

      if (!payment) {
        return errorResponse(res, 'Không tìm thấy giao dịch', 404);
      }

      // Check permission
      if (payment.studentId.toString() !== userId) {
        return errorResponse(
          res,
          'Bạn không có quyền xử lý giao dịch này',
          403
        );
      }

      // Check if payment has gateway response
      if (!payment.gatewayRawResponse) {
        return errorResponse(res, 'Giao dịch chưa có phản hồi từ VNPay', 400);
      }

      logger.info(`Reprocessing payment: ${orderId} by user: ${userId}`);

      // Reprocess with existing gateway response (skip signature verification)
      const result = await paymentScheduleService.processPaymentCallback(
        {
          query: payment.gatewayRawResponse,
        },
        true // Skip signature check since we trust stored data
      );

      return successResponse(res, 'Xử lý lại giao dịch thành công', result);
    } catch (error: any) {
      logger.error('Error in reprocessPayment:', error);
      return errorResponse(res, error.message, 500);
    }
  };
}

export const paymentController = new PaymentController();
