import { VNPay } from 'vnpay';
import { logger } from '../utils/logger';

/**
 * VNPay Configuration
 * Khởi tạo VNPay client với các thông số từ environment variables
 */
export const vnpayConfig = new VNPay({
  tmnCode: process.env.VNPAY_TMN_CODE || '',
  secureSecret: process.env.VNPAY_HASH_SECRET || '',
  vnpayHost: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn',
  testMode: process.env.VNPAY_TEST_MODE === 'true',

  /**
   * Tắt log mặc định của VNPay, sử dụng logger của hệ thống
   */
  enableLog: false,

  /**
   * Cấu hình endpoint API của VNPay
   */
  endpoints: {
    paymentEndpoint: 'paymentv2/vpcpay.html',
    queryDrRefundEndpoint: 'merchant_webapi/api/transaction',
    getBankListEndpoint: 'qrpayauth/api/merchant/get_bank_list',
  },
});

/**
 * Validate VNPay configuration
 */
export const validateVNPayConfig = (): boolean => {
  const requiredFields = {
    VNPAY_TMN_CODE: process.env.VNPAY_TMN_CODE,
    VNPAY_HASH_SECRET: process.env.VNPAY_HASH_SECRET,
    VNPAY_URL: process.env.VNPAY_URL,
    VNPAY_RETURN_URL: process.env.VNPAY_RETURN_URL,
  };

  const missingFields = Object.entries(requiredFields)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length > 0) {
    logger.error(
      `VNPay configuration missing required fields: ${missingFields.join(', ')}`
    );
    return false;
  }

  logger.info('VNPay configuration validated successfully');
  return true;
};
