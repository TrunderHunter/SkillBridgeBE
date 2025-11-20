import { Payment, PaymentSchedule, LearningClass } from '../../models';
import { vnpayService } from '../payment/vnpay.service';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Payment Service
 * Handles payment initiation, verification, and session payment status updates
 */

export interface IInitiatePaymentParams {
  learningClassId: string;
  studentId: string;
  paymentType: 'SINGLE_WEEK' | 'MULTI_WEEK' | 'FULL_REMAINING';
  sessionNumbers: number[]; // Which sessions to pay for
  ipAddress: string;
  userAgent?: string;
}

export interface IPaymentCallbackParams {
  query: any; // VNPay return query
}

class PaymentScheduleService {
  /**
   * Initiate payment for selected sessions
   * Creates Payment record and generates VNPay payment URL
   */
  async initiatePayment(params: IInitiatePaymentParams): Promise<{
    payment: any;
    paymentUrl: string;
  }> {
    try {
      const {
        learningClassId,
        studentId,
        paymentType,
        sessionNumbers,
        ipAddress,
        userAgent,
      } = params;

      // Get learning class with payment schedule
      const learningClass = await LearningClass.findOne({
        _id: learningClassId,
        studentId,
      });

      if (!learningClass) {
        throw new Error(
          'Lớp học không tồn tại hoặc bạn không có quyền truy cập'
        );
      }

      // Get payment schedule
      const paymentSchedule = await PaymentSchedule.findOne({
        learningClassId,
        studentId,
      });

      if (!paymentSchedule) {
        throw new Error('Không tìm thấy lịch thanh toán cho lớp học này');
      }

      // Validate session numbers
      if (!sessionNumbers || sessionNumbers.length === 0) {
        throw new Error('Vui lòng chọn ít nhất một buổi học để thanh toán');
      }

      // Get installments for selected sessions
      const selectedInstallments = paymentSchedule.installments.filter((inst) =>
        sessionNumbers.includes(inst.sessionNumber)
      );

      if (selectedInstallments.length !== sessionNumbers.length) {
        throw new Error('Một số buổi học không hợp lệ');
      }

      // Check if all selected sessions are UNPAID
      const unpaidInstallments = selectedInstallments.filter(
        (inst) => inst.status === 'UNPAID' || inst.status === 'OVERDUE'
      );

      if (unpaidInstallments.length !== selectedInstallments.length) {
        throw new Error(
          'Một số buổi học đã được thanh toán hoặc đang chờ xử lý'
        );
      }

      // Calculate total amount
      const totalAmount = unpaidInstallments.reduce(
        (sum, inst) => sum + inst.amount,
        0
      );

      // Generate unique order ID
      const orderId = `ORDER_${uuidv4().replace(/-/g, '').substring(0, 20).toUpperCase()}`;

      // Set expiration time (5 minutes from now)
      const expireDate = new Date();
      expireDate.setMinutes(expireDate.getMinutes() + 5);

      // Create Payment record
      const payment = await Payment.create({
        paymentScheduleId: paymentSchedule._id,
        contractId: paymentSchedule.contractId,
        learningClassId,
        studentId,
        tutorId: learningClass.tutorId,
        orderId,
        amount: totalAmount,
        paymentType,
        sessionNumbers,
        paymentMethod: 'VNPAY',
        paymentGateway: 'VNPAY',
        status: 'PENDING',
        description: `Thanh toán ${sessionNumbers.length} buổi học - ${learningClass.title}`,
        ipAddress,
        userAgent,
        expiredAt: expireDate,
      });

      // Mark installments as PENDING
      unpaidInstallments.forEach((inst) => {
        inst.status = 'PENDING';
      });
      await paymentSchedule.save();

      // Generate VNPay payment URL
      // IMPORTANT: Remove Vietnamese accents from orderInfo to avoid signature mismatch
      const classTitle = this.removeVietnameseAccents(
        learningClass.title || 'Lop hoc'
      );
      const paymentUrl = await vnpayService.createPaymentUrl({
        orderId,
        amount: totalAmount,
        orderInfo: `Thanh toan hoc phi - ${classTitle} - ${sessionNumbers.length} buoi`,
        ipAddress,
      });

      logger.info(
        `Payment initiated: ${orderId}, amount: ${totalAmount}, sessions: ${sessionNumbers.join(', ')}`
      );

      return {
        payment: payment.toJSON(),
        paymentUrl,
      };
    } catch (error: any) {
      logger.error('Error initiating payment:', error);
      throw new Error(error.message || 'Không thể khởi tạo thanh toán');
    }
  }

  /**
   * Process VNPay callback and update payment status
   * @param skipSignatureCheck - Skip signature verification (for reprocessing stored responses)
   */
  async processPaymentCallback(
    params: IPaymentCallbackParams,
    skipSignatureCheck: boolean = false
  ): Promise<{
    success: boolean;
    message: string;
    payment?: any;
  }> {
    try {
      const { query } = params;

      // Verify VNPay signature and extract data (skip for reprocessing)
      const verificationResult = await vnpayService.verifyReturnUrl(
        query,
        skipSignatureCheck
      );

      if (!verificationResult.isValid) {
        logger.warn(
          `Invalid VNPay signature for order: ${verificationResult.orderId}`
        );
        return {
          success: false,
          message: 'Chữ ký không hợp lệ',
        };
      }

      // Find payment by orderId
      const payment = await Payment.findOne({
        orderId: verificationResult.orderId,
      });

      if (!payment) {
        logger.error(
          `Payment not found for order: ${verificationResult.orderId}`
        );
        return {
          success: false,
          message: 'Không tìm thấy giao dịch',
        };
      }

      // Check if payment is already processed
      if (payment.status === 'COMPLETED') {
        logger.info(
          `Payment already completed for order: ${verificationResult.orderId}`
        );
        return {
          success: true,
          message: 'Giao dịch đã được xử lý',
          payment: payment.toJSON(),
        };
      }

      // Check if payment failed already and result is still failed - no need to reprocess
      if (payment.status === 'FAILED' && !verificationResult.isSuccess) {
        logger.info(
          `Payment already failed for order: ${verificationResult.orderId}`
        );
        return {
          success: false,
          message: verificationResult.message,
          payment: payment.toJSON(),
        };
      }

      // Verify amount matches
      if (verificationResult.amount !== payment.amount) {
        logger.error(
          `Amount mismatch for order: ${verificationResult.orderId}, expected: ${payment.amount}, received: ${verificationResult.amount}`
        );

        payment.status = 'FAILED';
        payment.gatewayResponseCode = verificationResult.responseCode;
        payment.gatewayRawResponse = verificationResult.rawData;
        await payment.save();

        // Reset installments to UNPAID when amount mismatch
        await this.resetInstallmentStatus(
          payment.paymentScheduleId,
          payment.sessionNumbers
        );

        return {
          success: false,
          message: 'Số tiền không khớp',
          payment: payment.toJSON(),
        };
      }

      // Update payment based on result
      if (verificationResult.isSuccess) {
        // Payment successful
        payment.status = 'COMPLETED';
        payment.paidAt = verificationResult.payDate || new Date();
        payment.gatewayTransactionId = verificationResult.transactionNo;
        payment.gatewayResponseCode = verificationResult.responseCode;
        payment.gatewayBankCode = verificationResult.bankCode;
        payment.gatewayCardType = verificationResult.cardType;
        payment.gatewayRawResponse = verificationResult.rawData;

        await payment.save();

        // CRITICAL: Update payment schedule and session status
        // This will change installments from PENDING/UNPAID to PAID
        await this.updateSessionPaymentStatus(
          payment.paymentScheduleId,
          payment.sessionNumbers,
          payment._id
        );

        logger.info(
          `Payment completed successfully: ${payment.orderId}, amount: ${payment.amount}, sessions: ${payment.sessionNumbers.join(',')}`
        );

        return {
          success: true,
          message: 'Thanh toán thành công',
          payment: payment.toJSON(),
        };
      } else {
        // Payment failed
        payment.status = 'FAILED';
        payment.gatewayResponseCode = verificationResult.responseCode;
        payment.gatewayRawResponse = verificationResult.rawData;
        await payment.save();

        // Reset installments to UNPAID
        await this.resetInstallmentStatus(
          payment.paymentScheduleId,
          payment.sessionNumbers
        );

        logger.info(
          `Payment failed: ${payment.orderId}, reason: ${verificationResult.message}`
        );

        return {
          success: false,
          message: verificationResult.message,
          payment: payment.toJSON(),
        };
      }
    } catch (error: any) {
      logger.error('Error processing payment callback:', error);
      throw new Error(error.message || 'Không thể xử lý kết quả thanh toán');
    }
  }

  /**
   * Update session payment status after successful payment
   */
  private async updateSessionPaymentStatus(
    paymentScheduleId: string,
    sessionNumbers: number[],
    paymentId: string
  ): Promise<void> {
    try {
      // Update payment schedule installments
      const paymentSchedule = await PaymentSchedule.findById(paymentScheduleId);
      if (!paymentSchedule) {
        throw new Error('Payment schedule not found');
      }

      let totalPaidAmount = 0;

      sessionNumbers.forEach((sessionNumber) => {
        const installment = paymentSchedule.installments.find(
          (inst) => inst.sessionNumber === sessionNumber
        );
        if (installment) {
          // Update installment status from PENDING/UNPAID to PAID
          const previousStatus = installment.status;
          installment.status = 'PAID';
          installment.paidAt = new Date();
          installment.paymentId = paymentId;
          installment.paymentMethod = 'VNPAY';

          // Only add to total if not already paid
          if (previousStatus !== 'PAID') {
            totalPaidAmount += installment.amount;
          }

          logger.info(
            `Installment updated: session ${sessionNumber}, ${previousStatus} → PAID`
          );
        }
      });

      // Update paid amount
      paymentSchedule.paidAmount += totalPaidAmount;

      // Check if all payments completed
      const allPaid = paymentSchedule.installments.every(
        (inst) => inst.status === 'PAID' || inst.status === 'CANCELLED'
      );

      if (allPaid) {
        paymentSchedule.status = 'COMPLETED';
        paymentSchedule.completedAt = new Date();
      } else if (paymentSchedule.status === 'PENDING') {
        paymentSchedule.status = 'ACTIVE';
      }

      await paymentSchedule.save();

      // Update learning class sessions
      const learningClass = await LearningClass.findById(
        paymentSchedule.learningClassId
      );
      if (learningClass) {
        sessionNumbers.forEach((sessionNumber) => {
          const session = learningClass.sessions.find(
            (s) => s.sessionNumber === sessionNumber
          );
          if (session) {
            session.paymentStatus = 'PAID';
          }
        });

        // Update class payment status
        const totalSessions = learningClass.sessions.length;
        const paidSessions = learningClass.sessions.filter(
          (s) => s.paymentStatus === 'PAID'
        ).length;

        if (paidSessions === totalSessions) {
          learningClass.paymentStatus = 'COMPLETED';
        } else if (paidSessions > 0) {
          learningClass.paymentStatus = 'PARTIAL';
        }

        learningClass.paidAmount = paymentSchedule.paidAmount;

        await learningClass.save();
      }

      logger.info(
        `Session payment status updated for sessions: ${sessionNumbers.join(', ')}`
      );
    } catch (error: any) {
      logger.error('Error updating session payment status:', error);
      throw error;
    }
  }

  /**
   * Check and cancel expired PENDING payments
   * Payments expire after 5 minutes
   */
  async cancelExpiredPayments(learningClassId: string): Promise<void> {
    try {
      const now = new Date();

      // Find all PENDING payments for this class that are expired
      const expiredPayments = await Payment.find({
        learningClassId,
        status: 'PENDING',
        expiredAt: { $lt: now },
      });

      if (expiredPayments.length === 0) {
        return;
      }

      logger.info(
        `Found ${expiredPayments.length} expired PENDING payments for class: ${learningClassId}`
      );

      // Cancel each expired payment and reset installments
      for (const payment of expiredPayments) {
        payment.status = 'CANCELLED';
        await payment.save();

        // Reset installments to UNPAID
        await this.resetInstallmentStatus(
          payment.paymentScheduleId.toString(),
          payment.sessionNumbers
        );

        logger.info(
          `Cancelled expired payment: ${payment.orderId}, sessions: ${payment.sessionNumbers.join(',')}`
        );
      }
    } catch (error: any) {
      logger.error('Error cancelling expired payments:', error);
    }
  }

  /**
   * Reset installment status to UNPAID when payment fails
   */
  private async resetInstallmentStatus(
    paymentScheduleId: string,
    sessionNumbers: number[]
  ): Promise<void> {
    try {
      const paymentSchedule = await PaymentSchedule.findById(paymentScheduleId);
      if (!paymentSchedule) {
        return;
      }

      sessionNumbers.forEach((sessionNumber) => {
        const installment = paymentSchedule.installments.find(
          (inst) => inst.sessionNumber === sessionNumber
        );
        if (installment && installment.status === 'PENDING') {
          installment.status = 'UNPAID';
        }
      });

      await paymentSchedule.save();

      logger.info(
        `Installment status reset to UNPAID for sessions: ${sessionNumbers.join(', ')}`
      );
    } catch (error: any) {
      logger.error('Error resetting installment status:', error);
    }
  }

  /**
   * Get available sessions for payment
   */
  async getAvailableSessionsForPayment(
    learningClassId: string,
    studentId: string
  ): Promise<{
    unpaidSessions: any[];
    totalUnpaidAmount: number;
  }> {
    try {
      // Cancel any expired PENDING payments first
      await this.cancelExpiredPayments(learningClassId);

      const paymentSchedule = await PaymentSchedule.findOne({
        learningClassId,
        studentId,
      });

      if (!paymentSchedule) {
        throw new Error('Không tìm thấy lịch thanh toán');
      }

      const unpaidInstallments = paymentSchedule.installments.filter(
        (inst) => inst.status === 'UNPAID' || inst.status === 'OVERDUE'
      );

      const totalUnpaidAmount = unpaidInstallments.reduce(
        (sum, inst) => sum + inst.amount,
        0
      );

      return {
        unpaidSessions: unpaidInstallments.map((inst) => ({
          sessionNumber: inst.sessionNumber,
          amount: inst.amount,
          dueDate: inst.dueDate,
          status: inst.status,
        })),
        totalUnpaidAmount,
      };
    } catch (error: any) {
      logger.error('Error getting available sessions for payment:', error);
      throw new Error(error.message || 'Không thể lấy danh sách buổi học');
    }
  }

  /**
   * Get active PENDING payment for a learning class
   * Returns null if no active pending payment exists
   */
  async getPendingPayment(
    learningClassId: string,
    studentId: string
  ): Promise<any | null> {
    try {
      // Find the most recent PENDING payment that hasn't expired
      const pendingPayment = await Payment.findOne({
        learningClassId,
        studentId,
        status: 'PENDING',
        expiredAt: { $gt: new Date() }, // Not expired yet
      }).sort({ createdAt: -1 }); // Get most recent

      return pendingPayment;
    } catch (error: any) {
      logger.error('Error getting pending payment:', error);
      return null;
    }
  }

  /**
   * Get payment by order ID
   */
  async getPaymentByOrderId(orderId: string): Promise<any> {
    try {
      const payment = await Payment.findOne({ orderId })
        .populate('studentId', 'full_name email')
        .populate('tutorId', 'full_name email')
        .populate('learningClassId', 'title');

      if (!payment) {
        throw new Error('Không tìm thấy giao dịch');
      }

      return payment.toJSON();
    } catch (error: any) {
      logger.error('Error getting payment by order ID:', error);
      throw new Error(error.message || 'Không thể lấy thông tin giao dịch');
    }
  }

  /**
   * Get student's payment history
   */
  async getStudentPaymentHistory(
    studentId: string,
    filters: any = {}
  ): Promise<{
    payments: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const { page = 1, limit = 10, status, learningClassId } = filters;
      const skip = (page - 1) * limit;

      const query: any = { studentId };
      if (status) query.status = status;
      if (learningClassId) query.learningClassId = learningClassId;

      const [payments, total] = await Promise.all([
        Payment.find(query)
          .populate('learningClassId', 'title')
          .populate('tutorId', 'full_name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Payment.countDocuments(query),
      ]);

      // Return empty array if no payments found
      return {
        payments: payments.map((p) => p.toJSON()),
        total,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error('Error getting student payment history:', error);
      throw new Error(error.message || 'Không thể lấy lịch sử thanh toán');
    }
  }

  /**
   * Remove Vietnamese accents from string for VNPay orderInfo
   * VNPay doesn't accept Unicode characters in payment parameters
   */
  private removeVietnameseAccents(str: string): string {
    // Map of Vietnamese characters to their non-accented equivalents
    const AccentsMap: { [key: string]: string } = {
      à: 'a',
      á: 'a',
      ả: 'a',
      ã: 'a',
      ạ: 'a',
      ă: 'a',
      ằ: 'a',
      ắ: 'a',
      ẳ: 'a',
      ẵ: 'a',
      ặ: 'a',
      â: 'a',
      ầ: 'a',
      ấ: 'a',
      ẩ: 'a',
      ẫ: 'a',
      ậ: 'a',
      đ: 'd',
      è: 'e',
      é: 'e',
      ẻ: 'e',
      ẽ: 'e',
      ẹ: 'e',
      ê: 'e',
      ề: 'e',
      ế: 'e',
      ể: 'e',
      ễ: 'e',
      ệ: 'e',
      ì: 'i',
      í: 'i',
      ỉ: 'i',
      ĩ: 'i',
      ị: 'i',
      ò: 'o',
      ó: 'o',
      ỏ: 'o',
      õ: 'o',
      ọ: 'o',
      ô: 'o',
      ồ: 'o',
      ố: 'o',
      ổ: 'o',
      ỗ: 'o',
      ộ: 'o',
      ơ: 'o',
      ờ: 'o',
      ớ: 'o',
      ở: 'o',
      ỡ: 'o',
      ợ: 'o',
      ù: 'u',
      ú: 'u',
      ủ: 'u',
      ũ: 'u',
      ụ: 'u',
      ư: 'u',
      ừ: 'u',
      ứ: 'u',
      ử: 'u',
      ữ: 'u',
      ự: 'u',
      ỳ: 'y',
      ý: 'y',
      ỷ: 'y',
      ỹ: 'y',
      ỵ: 'y',
      À: 'A',
      Á: 'A',
      Ả: 'A',
      Ã: 'A',
      Ạ: 'A',
      Ă: 'A',
      Ằ: 'A',
      Ắ: 'A',
      Ẳ: 'A',
      Ẵ: 'A',
      Ặ: 'A',
      Â: 'A',
      Ầ: 'A',
      Ấ: 'A',
      Ẩ: 'A',
      Ẫ: 'A',
      Ậ: 'A',
      Đ: 'D',
      È: 'E',
      É: 'E',
      Ẻ: 'E',
      Ẽ: 'E',
      Ẹ: 'E',
      Ê: 'E',
      Ề: 'E',
      Ế: 'E',
      Ể: 'E',
      Ễ: 'E',
      Ệ: 'E',
      Ì: 'I',
      Í: 'I',
      Ỉ: 'I',
      Ĩ: 'I',
      Ị: 'I',
      Ò: 'O',
      Ó: 'O',
      Ỏ: 'O',
      Õ: 'O',
      Ọ: 'O',
      Ô: 'O',
      Ồ: 'O',
      Ố: 'O',
      Ổ: 'O',
      Ỗ: 'O',
      Ộ: 'O',
      Ơ: 'O',
      Ờ: 'O',
      Ớ: 'O',
      Ở: 'O',
      Ỡ: 'O',
      Ợ: 'O',
      Ù: 'U',
      Ú: 'U',
      Ủ: 'U',
      Ũ: 'U',
      Ụ: 'U',
      Ư: 'U',
      Ừ: 'U',
      Ứ: 'U',
      Ử: 'U',
      Ữ: 'U',
      Ự: 'U',
      Ỳ: 'Y',
      Ý: 'Y',
      Ỷ: 'Y',
      Ỹ: 'Y',
      Ỵ: 'Y',
    };

    return str
      .split('')
      .map((char) => AccentsMap[char] || char)
      .join('')
      .replace(/[^a-zA-Z0-9 -]/g, ''); // Remove any remaining special characters
  }
}

export const paymentScheduleService = new PaymentScheduleService();
