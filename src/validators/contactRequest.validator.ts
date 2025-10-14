import { body, ValidationChain } from 'express-validator';

export const validateContactRequest = {
  createRequest: [
    body('tutorPostId')
      .notEmpty()
      .withMessage('ID bài đăng gia sư là bắt buộc'),

    body('subject')
      .notEmpty()
      .withMessage('Môn học là bắt buộc'),

    body('message')
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Tin nhắn phải có từ 10 đến 1000 ký tự'),

    body('learningMode')
      .isIn(['ONLINE', 'OFFLINE', 'FLEXIBLE'])
      .withMessage('Hình thức học không hợp lệ'),

    body('expectedPrice')
      .optional()
      .isInt({ min: 50000, max: 10000000 })
      .withMessage('Giá mong muốn phải từ 50,000 đến 10,000,000 VNĐ'),

    body('sessionDuration')
      .optional()
      .isIn([60, 90, 120, 150, 180])
      .withMessage('Thời lượng buổi học không hợp lệ'),

    body('preferredSchedule')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Lịch học mong muốn không được vượt quá 500 ký tự'),

    body('studentContact.preferredContactMethod')
      .isIn(['phone', 'email', 'both'])
      .withMessage('Phương thức liên hệ không hợp lệ'),

    body('studentContact.phone')
      .optional()
      .matches(/^(\+84|0)[3|5|7|8|9][0-9]{8}$/)
      .withMessage('Số điện thoại không hợp lệ'),

    body('studentContact.email')
      .optional()
      .isEmail()
      .withMessage('Email không hợp lệ'),
  ] as ValidationChain[],

  respondToRequest: [
    body('action')
      .isIn(['ACCEPT', 'REJECT'])
      .withMessage('Hành động phải là ACCEPT hoặc REJECT'),

    body('message')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Tin nhắn không được vượt quá 1000 ký tự'),

    body('rejectionReason')
      .if(body('action').equals('REJECT'))
      .notEmpty() 
      .isIn([
        'SCHEDULE_CONFLICT',
        'PRICE_DISAGREEMENT', 
        'STUDENT_LEVEL_MISMATCH',
        'LOCATION_ISSUE',
        'PERSONAL_REASON',
        'OTHER'
      ])
      .withMessage('Lý do từ chối không hợp lệ'),

    body('counterOffer.pricePerSession')
      // Chỉ validate trường này KHI action là 'ACCEPT'
      .if(body('action').equals('ACCEPT')) 
      .optional()
      .isInt({ min: 50000, max: 10000000 })
      .withMessage('Giá đề xuất phải từ 50,000 đến 10,000,000 VNĐ'),

    body('counterOffer.sessionDuration')
      // Chỉ validate trường này KHI action là 'ACCEPT'
      .if(body('action').equals('ACCEPT'))
      .optional()
      .isIn([60, 90, 120, 150, 180])
      .withMessage('Thời lượng đề xuất không hợp lệ'),
  ] as ValidationChain[],

  createLearningClass: [
    body('contactRequestId')
      .notEmpty()
      .withMessage('ID yêu cầu liên hệ là bắt buộc'),

    body('title')
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Tiêu đề lớp học phải có từ 5 đến 200 ký tự'),

    body('totalSessions')
      .isInt({ min: 1, max: 100 })
      .withMessage('Số buổi học phải từ 1 đến 100'),

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
};