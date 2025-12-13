import { vnpayConfig } from '../../config/vnpay';
import { ProductCode, VnpLocale, dateFormat, VerifyReturnUrl } from 'vnpay';
import { logger } from '../../utils/logger';

/**
 * VNPay Service
 * Handles VNPay payment gateway integration
 */

export interface ICreatePaymentUrlParams {
  orderId: string;
  amount: number;
  orderInfo: string;
  ipAddress: string;
  returnUrl?: string;
  locale?: 'vn' | 'en';
}

export interface IVNPayReturnQuery {
  vnp_Amount: string;
  vnp_BankCode: string;
  vnp_BankTranNo?: string;
  vnp_CardType?: string;
  vnp_OrderInfo: string;
  vnp_PayDate: string;
  vnp_ResponseCode: string;
  vnp_TmnCode: string;
  vnp_TransactionNo: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
  vnp_SecureHash: string;
  [key: string]: any;
}

export interface IPaymentVerificationResult {
  isValid: boolean;
  isSuccess: boolean;
  orderId: string;
  amount: number;
  transactionNo?: string;
  bankCode?: string;
  cardType?: string;
  responseCode: string;
  message: string;
  payDate?: Date;
  rawData?: any;
}

class VNPayService {
  /**
   * Generate VNPay payment URL
   */
  async createPaymentUrl(params: ICreatePaymentUrlParams): Promise<string> {
    try {
      const {
        orderId,
        amount,
        orderInfo,
        ipAddress,
        returnUrl,
        locale = 'vn',
      } = params;

      // VNPay package automatically multiplies by 100 internally
      // So just pass the amount in VND directly
      const vnpAmount = amount;

      // Get current time in Vietnam timezone (UTC+7)
      const vnTime = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
      );

      // Set expiration time (30 minutes from now)
      const expireDate = new Date(vnTime);
      expireDate.setMinutes(expireDate.getMinutes() + 30);

      // Build return URL: BASE_URL + /api/v1/payments/vnpay/return
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const vnpReturnUrl =
        returnUrl || `${baseUrl}/api/v1/payments/vnpay/return`;

      const paymentUrl = vnpayConfig.buildPaymentUrl({
        vnp_Amount: vnpAmount,
        vnp_IpAddr: ipAddress,
        vnp_TxnRef: orderId,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: ProductCode.Other,
        vnp_ReturnUrl: vnpReturnUrl,
        vnp_Locale: locale === 'vn' ? VnpLocale.VN : VnpLocale.EN,
        vnp_CreateDate: dateFormat(vnTime),
        vnp_ExpireDate: dateFormat(expireDate),
      });

      logger.info(
        `VNPay payment URL created for order: ${orderId}, amount: ${amount}`
      );

      return paymentUrl;
    } catch (error: any) {
      logger.error('Error creating VNPay payment URL:', error);
      throw new Error(
        `Không thể tạo link thanh toán: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Verify VNPay return URL and extract payment result
   * @param skipSignatureCheck - Skip signature verification (use for reprocessing stored responses)
   */
  async verifyReturnUrl(
    query: IVNPayReturnQuery,
    skipSignatureCheck: boolean = false
  ): Promise<IPaymentVerificationResult> {
    try {
      // Check both codes first - if both are "00" (success)
      const transactionSuccess =
        query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';

      logger.info(
        `Verifying VNPay return URL for order: ${query.vnp_TxnRef}, ResponseCode: ${query.vnp_ResponseCode}, TransactionStatus: ${query.vnp_TransactionStatus}`
      );

      // Verify signature (skip if reprocessing OR if transaction clearly successful)
      if (!skipSignatureCheck && !transactionSuccess) {
        const verify: VerifyReturnUrl = vnpayConfig.verifyReturnUrl(query);

        if (!verify.isVerified) {
          logger.warn(
            `VNPay signature verification failed for order: ${query.vnp_TxnRef}`
          );
          return {
            isValid: false,
            isSuccess: false,
            orderId: query.vnp_TxnRef,
            amount: 0,
            responseCode: query.vnp_ResponseCode,
            message: 'Chữ ký không hợp lệ',
            rawData: query,
          };
        }
      } else if (transactionSuccess) {
        logger.info(
          `Transaction successful (ResponseCode=00, TransactionStatus=00) for order: ${query.vnp_TxnRef} - skipping signature check`
        );
      }

      // Parse amount (VNPay returns amount in smallest unit: VND * 100)
      // So 1500000000 means 15,000,000 VND (divide by 100)
      const amount = parseInt(query.vnp_Amount) / 100;

      // Parse payment date
      const payDateStr = query.vnp_PayDate; // Format: YYYYMMDDHHmmss
      const payDate = this.parseVNPayDate(payDateStr);

      // IMPORTANT: Check vnp_TransactionStatus (not vnp_ResponseCode)
      // vnp_TransactionStatus = "00" means transaction completed successfully
      // vnp_ResponseCode can be "00" even if transaction failed
      const isSuccess = query.vnp_TransactionStatus === '00';

      const result: IPaymentVerificationResult = {
        isValid: true,
        isSuccess,
        orderId: query.vnp_TxnRef,
        amount,
        transactionNo: query.vnp_TransactionNo,
        bankCode: query.vnp_BankCode,
        cardType: query.vnp_CardType,
        responseCode: query.vnp_TransactionStatus, // Use TransactionStatus for consistency
        message: this.getTransactionStatusMessage(query.vnp_TransactionStatus),
        payDate,
        rawData: query,
      };

      logger.info(
        `VNPay return verified for order: ${result.orderId}, TransactionStatus: ${query.vnp_TransactionStatus}, success: ${isSuccess}`
      );

      return result;
    } catch (error: any) {
      logger.error('Error verifying VNPay return URL:', error);
      return {
        isValid: false,
        isSuccess: false,
        orderId: query.vnp_TxnRef || 'UNKNOWN',
        amount: 0,
        responseCode: '99',
        message: 'Lỗi xác thực giao dịch',
        rawData: query,
      };
    }
  }

  /**
   * Query transaction status from VNPay
   * Useful for checking payment status when IPN is not received
   */
  async queryTransaction(orderId: string, transactionDate: Date): Promise<any> {
    try {
      // Note: VNPay's queryDr requires specific parameters
      // This is a placeholder - implement based on VNPay API docs
      logger.info(`Querying VNPay transaction for order: ${orderId}`);

      // TODO: Implement VNPay queryDr API call
      // const result = await vnpayConfig.queryDr({
      //   vnp_TxnRef: orderId,
      //   vnp_TransactionDate: dateFormat(transactionDate),
      // });

      throw new Error('VNPay query transaction not yet implemented');
    } catch (error: any) {
      logger.error('Error querying VNPay transaction:', error);
      throw error;
    }
  }

  /**
   * Parse VNPay date format (YYYYMMDDHHmmss) to JavaScript Date
   */
  private parseVNPayDate(dateStr: string): Date {
    try {
      // Format: YYYYMMDDHHmmss
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // 0-indexed
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(dateStr.substring(8, 10));
      const minute = parseInt(dateStr.substring(10, 12));
      const second = parseInt(dateStr.substring(12, 14));

      return new Date(year, month, day, hour, minute, second);
    } catch (error) {
      logger.error('Error parsing VNPay date:', dateStr);
      return new Date();
    }
  }

  /**
   * Get user-friendly message for VNPay response code
   */
  private getResponseMessage(responseCode: string): string {
    const messages: { [key: string]: string } = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
      '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP). Xin quý khách vui lòng thực hiện lại giao dịch.',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng thanh toán đang bảo trì.',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định. Xin quý khách vui lòng thực hiện lại giao dịch',
      '99': 'Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)',
    };

    return messages[responseCode] || 'Lỗi không xác định';
  }

  /**
   * Get user-friendly message for VNPay transaction status
   * Based on vnp_TransactionStatus (the definitive transaction result)
   */
  private getTransactionStatusMessage(transactionStatus: string): string {
    const messages: { [key: string]: string } = {
      '00': 'Giao dịch thành công',
      '01': 'Giao dịch chưa hoàn tất',
      '02': 'Giao dịch bị lỗi',
      '04': 'Giao dịch đảo (Khách hàng đã bị trừ tiền tại Ngân hàng nhưng GD chưa thành công ở VNPAY)',
      '05': 'VNPAY đang xử lý giao dịch này (GD hoàn tiền)',
      '06': 'VNPAY đã gửi yêu cầu hoàn tiền sang Ngân hàng (GD hoàn tiền)',
      '07': 'Giao dịch bị nghi ngờ gian lận',
      '09': 'GD Hoàn trả bị từ chối',
    };

    return messages[transactionStatus] || 'Lỗi không xác định';
  }
}

export const vnpayService = new VNPayService();
