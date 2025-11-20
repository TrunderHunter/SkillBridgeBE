import { body, param, query, ValidationChain } from 'express-validator';

export const validatePayment = {
  /**
   * Validate initiate payment request
   */
  initiatePayment: [
    body('learningClassId')
      .notEmpty()
      .withMessage('ID lớp học là bắt buộc')
      .isString()
      .withMessage('ID lớp học không hợp lệ'),

    body('paymentType')
      .notEmpty()
      .withMessage('Loại thanh toán là bắt buộc')
      .isIn(['SINGLE_WEEK', 'MULTI_WEEK', 'FULL_REMAINING'])
      .withMessage('Loại thanh toán không hợp lệ'),

    body('sessionNumbers')
      .notEmpty()
      .withMessage('Danh sách buổi học là bắt buộc')
      .isArray({ min: 1 })
      .withMessage('Phải chọn ít nhất một buổi học')
      .custom((value) => {
        if (!Array.isArray(value)) return false;
        return value.every((num) => Number.isInteger(num) && num > 0);
      })
      .withMessage('Số buổi học không hợp lệ'),
  ] as ValidationChain[],

  /**
   * Validate get payment by order ID
   */
  getPaymentByOrderId: [
    param('orderId')
      .notEmpty()
      .withMessage('Order ID là bắt buộc')
      .isString()
      .withMessage('Order ID không hợp lệ'),
  ] as ValidationChain[],

  /**
   * Validate get available sessions
   */
  getAvailableSessions: [
    param('learningClassId')
      .notEmpty()
      .withMessage('ID lớp học là bắt buộc')
      .isString()
      .withMessage('ID lớp học không hợp lệ'),
  ] as ValidationChain[],

  /**
   * Validate payment history query
   */
  getPaymentHistory: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Số trang phải lớn hơn 0')
      .toInt(),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Số lượng phải từ 1 đến 100')
      .toInt(),

    query('status')
      .optional()
      .isIn(['PENDING', 'COMPLETED', 'FAILED', 'EXPIRED', 'REFUNDED'])
      .withMessage('Trạng thái không hợp lệ'),

    query('learningClassId')
      .optional()
      .isString()
      .withMessage('ID lớp học không hợp lệ'),
  ] as ValidationChain[],
};
