import { body, ValidationChain } from 'express-validator';

export const validateContract = {
  createContract: [
    body('contactRequestId')
      .notEmpty()
      .withMessage('ID yêu cầu liên hệ là bắt buộc'),

    body('title')
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Tiêu đề hợp đồng phải có từ 5 đến 200 ký tự'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Mô tả không được vượt quá 1000 ký tự'),

    body('pricePerSession')
      .isInt({ min: 50000, max: 10000000 })
      .withMessage('Giá mỗi buổi phải từ 50,000 đến 10,000,000 VNĐ'),

    body('sessionDuration')
      .isIn([60, 90, 120, 150, 180])
      .withMessage('Thời lượng buổi học không hợp lệ'),

    body('totalSessions')
      .isInt({ min: 1, max: 100 })
      .withMessage('Số buổi học phải từ 1 đến 100'),

    body('learningMode')
      .isIn(['ONLINE', 'OFFLINE'])
      .withMessage('Hình thức học không hợp lệ'),

    body('schedule.dayOfWeek')
      .isArray({ min: 1, max: 7 })
      .withMessage('Phải chọn ít nhất 1 ngày trong tuần'),

    body('schedule.dayOfWeek.*')
      .isInt({ min: 0, max: 6 })
      .withMessage('Ngày trong tuần không hợp lệ'),

    body('schedule.startTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Giờ bắt đầu không hợp lệ (HH:mm)'),

    body('schedule.endTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Giờ kết thúc không hợp lệ (HH:mm)')
      .custom((endTime, { req }) => {
        const startTime = req.body.schedule?.startTime;
        if (startTime && endTime <= startTime) {
          throw new Error('Giờ kết thúc phải sau giờ bắt đầu');
        }
        return true;
      }),

    body('startDate')
      .isISO8601()
      .withMessage('Ngày bắt đầu không hợp lệ')
      .custom((value) => {
        const startDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (startDate < today) {
          throw new Error('Ngày bắt đầu không được trong quá khứ');
        }
        return true;
      }),

    body('endDate')
      .isISO8601()
      .withMessage('Ngày kết thúc không hợp lệ')
      .custom((endDate, { req }) => {
        const startDate = new Date(req.body.startDate);
        const end = new Date(endDate);
        
        if (end <= startDate) {
          throw new Error('Ngày kết thúc phải sau ngày bắt đầu');
        }
        return true;
      }),

    body('location.address')
      .if(body('learningMode').equals('OFFLINE'))
      .notEmpty()
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('Địa chỉ phải có từ 10 đến 500 ký tự khi học offline'),

    body('onlineInfo.platform')
      .if(body('learningMode').equals('ONLINE'))
      .isIn(['ZOOM', 'GOOGLE_MEET', 'MICROSOFT_TEAMS', 'OTHER'])
      .withMessage('Nền tảng học online không hợp lệ'),

    body('paymentTerms.paymentMethod')
      .isIn(['FULL', 'INSTALLMENT'])
      .withMessage('Phương thức thanh toán không hợp lệ'),

    body('paymentTerms.installments')
      .if(body('paymentTerms.paymentMethod').equals('INSTALLMENT'))
      .notEmpty()
      .isInt({ min: 2, max: 12 })
      .withMessage('Số kỳ thanh toán phải từ 2 đến 12'),

    body('paymentTerms.downPayment')
      .if(body('paymentTerms.paymentMethod').equals('INSTALLMENT'))
      .optional()
      .isInt({ min: 0 })
      .withMessage('Tiền đặt cọc phải >= 0'),
  ] as ValidationChain[],

  updateContract: [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Tiêu đề hợp đồng phải có từ 5 đến 200 ký tự'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Mô tả không được vượt quá 1000 ký tự'),

    body('schedule.dayOfWeek')
      .optional()
      .isArray({ min: 1, max: 7 })
      .withMessage('Phải chọn ít nhất 1 ngày trong tuần'),

    body('schedule.dayOfWeek.*')
      .optional()
      .isInt({ min: 0, max: 6 })
      .withMessage('Ngày trong tuần không hợp lệ'),

    body('schedule.startTime')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Giờ bắt đầu không hợp lệ (HH:mm)'),

    body('schedule.endTime')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Giờ kết thúc không hợp lệ (HH:mm)'),

    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('Ngày bắt đầu không hợp lệ'),

    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('Ngày kết thúc không hợp lệ'),

    body('location.address')
      .optional()
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('Địa chỉ phải có từ 10 đến 500 ký tự'),

    body('onlineInfo.platform')
      .optional()
      .isIn(['ZOOM', 'GOOGLE_MEET', 'MICROSOFT_TEAMS', 'OTHER'])
      .withMessage('Nền tảng học online không hợp lệ'),
  ] as ValidationChain[],

  signContract: [
    body('signatureData')
      .optional()
      .isString()
      .withMessage('Dữ liệu chữ ký không hợp lệ'),
  ] as ValidationChain[],

  markPaymentPaid: [
    body('paymentMethod')
      .notEmpty()
      .withMessage('Phương thức thanh toán là bắt buộc'),

    body('paidAmount')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Số tiền thanh toán phải >= 0'),

    body('transactionId')
      .optional()
      .isString()
      .withMessage('Mã giao dịch không hợp lệ'),

    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Ghi chú không được vượt quá 500 ký tự'),
  ] as ValidationChain[],
};
