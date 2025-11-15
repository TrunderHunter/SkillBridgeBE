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

    body('description').optional().trim(),

    body('totalSessions')
      .toInt()
      .isInt({ min: 1, max: 100 })
      .withMessage('Số buổi học phải từ 1 đến 100'),

    body('pricePerSession')
      .optional()
      .toInt()
      .isInt({ min: 50000, max: 10000000 })
      .withMessage('Giá mỗi buổi phải từ 50,000 đến 10,000,000 VNĐ'),

    body('totalAmount')
      .optional()
      .toInt()
      .isInt({ min: 50000 })
      .withMessage('Tổng số tiền phải ít nhất 50,000 VNĐ'),

    body('sessionDuration')
      .optional()
      .toInt()
      .isIn([60, 90, 120, 150, 180])
      .withMessage('Thời lượng buổi học không hợp lệ'),

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

    body('schedule.dayOfWeek')
      .isArray({ min: 1, max: 7 })
      .withMessage('Phải chọn ít nhất 1 ngày trong tuần'),

    body('schedule.dayOfWeek.*')
      .isInt({ min: 0, max: 6 })
      .withMessage('Ngày trong tuần không hợp lệ (0-6)'),

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

    // Location validation (for offline classes)
    body('location.address')
      .if(body('location').exists())
      .optional()
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Địa chỉ phải có từ 5 đến 500 ký tự'),

    body('location.coordinates.latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Vĩ độ không hợp lệ'),

    body('location.coordinates.longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Kinh độ không hợp lệ'),

    // Online info validation (for online classes)
    body('onlineInfo.platform')
      .optional()
      .isIn(['ZOOM', 'GOOGLE_MEET', 'MICROSOFT_TEAMS', 'OTHER'])
      .withMessage('Nền tảng học online không hợp lệ'),

    body('onlineInfo.meetingLink')
      .if(body('onlineInfo.platform').exists())
      .optional()
      .custom((value, { req }) => {
        // Chỉ validate URL nếu có giá trị và không rỗng
        if (value && value.trim() !== '') {
          const urlRegex =
            /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
          if (!urlRegex.test(value)) {
            throw new Error('Link phòng học không hợp lệ');
          }
        }
        return true;
      }),

    // Payment terms validation
    body('paymentTerms.paymentMethod')
      .optional()
      .isIn(['FULL_PAYMENT', 'INSTALLMENTS'])
      .withMessage('Phương thức thanh toán không hợp lệ'),

    body('paymentTerms.installmentPlan.numberOfInstallments')
      .if(body('paymentTerms.paymentMethod').equals('INSTALLMENTS'))
      .isInt({ min: 2, max: 10 })
      .withMessage('Số kỳ thanh toán phải từ 2 đến 10'),

    body('paymentTerms.installmentPlan.firstPaymentPercentage')
      .if(body('paymentTerms.paymentMethod').equals('INSTALLMENTS'))
      .isInt({ min: 10, max: 90 })
      .withMessage('Phần trăm thanh toán đầu phải từ 10% đến 90%'),
  ] as ValidationChain[],

  respondToContract: [
    body('action')
      .isIn(['APPROVE', 'REJECT', 'REQUEST_CHANGES'])
      .withMessage('Hành động phải là APPROVE, REJECT hoặc REQUEST_CHANGES'),

    body('message')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Tin nhắn không được vượt quá 500 ký tự'),

    body('requestedChanges')
      .if(body('action').equals('REQUEST_CHANGES'))
      .notEmpty()
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Yêu cầu thay đổi phải có từ 10 đến 1000 ký tự'),
  ] as ValidationChain[],

  processPayment: [
    body('installmentNumber')
      .isInt({ min: 1, max: 10 })
      .withMessage('Số kỳ thanh toán không hợp lệ'),

    body('amount')
      .isInt({ min: 10000 })
      .withMessage('Số tiền thanh toán phải tối thiểu 10,000 VNĐ'),

    body('paymentMethod')
      .isIn(['BANK_TRANSFER', 'CREDIT_CARD', 'E_WALLET', 'CASH'])
      .withMessage('Phương thức thanh toán không hợp lệ'),

    body('transactionId')
      .optional()
      .trim()
      .isLength({ min: 5, max: 100 })
      .withMessage('Mã giao dịch phải có từ 5 đến 100 ký tự'),

    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Ghi chú không được vượt quá 500 ký tự'),
  ] as ValidationChain[],

  cancelContract: [
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Lý do hủy không được vượt quá 500 ký tự'),
  ] as ValidationChain[],

  // Contract signing validators
  initiateContractSigning: [
    body('role')
      .isIn(['student', 'tutor'])
      .withMessage('Role phải là student hoặc tutor'),
  ] as ValidationChain[],

  verifyContractSignature: [
    body('otpCode')
      .isLength({ min: 6, max: 6 })
      .withMessage('Mã OTP phải có đúng 6 ký tự')
      .isNumeric()
      .withMessage('Mã OTP chỉ chứa số'),

    body('role')
      .isIn(['student', 'tutor'])
      .withMessage('Role phải là student hoặc tutor'),

    body('consentText')
      .notEmpty()
      .withMessage('Văn bản đồng ý là bắt buộc')
      .isLength({ min: 20, max: 1000 })
      .withMessage('Văn bản đồng ý phải có từ 20 đến 1000 ký tự'),
  ] as ValidationChain[],

  resendContractOTP: [
    body('role')
      .isIn(['student', 'tutor'])
      .withMessage('Role phải là student hoặc tutor'),
  ] as ValidationChain[],

  approveAndSignContract: [
    body('otpCode')
      .isLength({ min: 6, max: 6 })
      .withMessage('Mã OTP phải có đúng 6 ký tự')
      .isNumeric()
      .withMessage('Mã OTP chỉ chứa số'),

    body('consentText')
      .notEmpty()
      .withMessage('Văn bản đồng ý là bắt buộc')
      .isLength({ min: 20, max: 1000 })
      .withMessage('Văn bản đồng ý phải có từ 20 đến 1000 ký tự'),

    body('message')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Tin nhắn không được vượt quá 500 ký tự'),
  ] as ValidationChain[],
};
