import { body, param, query, ValidationChain } from 'express-validator';
import {
  EducationLevel,
  AchievementLevel,
  AchievementType,
} from '../types/verification.types';

export class QualificationValidator {
  /**
   * Validator cho tạo/cập nhật Education
   */
  static education(): ValidationChain[] {
    return [
      body('level')
        .isIn(Object.values(EducationLevel))
        .withMessage('Trình độ học vấn không hợp lệ'),

      body('school')
        .notEmpty()
        .withMessage('Tên trường không được để trống')
        .isLength({ min: 2, max: 200 })
        .withMessage('Tên trường phải từ 2-200 ký tự'),

      body('startYear')
        .isInt({ min: 1950, max: new Date().getFullYear() })
        .withMessage(
          `Năm bắt đầu phải từ 1950 đến ${new Date().getFullYear()}`
        ),

      body('endYear')
        .isInt({ min: 1950, max: new Date().getFullYear() + 10 })
        .withMessage(
          `Năm kết thúc phải từ 1950 đến ${new Date().getFullYear() + 10}`
        ),
    ];
  }

  /**
   * Validator cho tạo/cập nhật Certificate
   */
  static certificate(): ValidationChain[] {
    return [
      body('name')
        .notEmpty()
        .withMessage('Tên chứng chỉ không được để trống')
        .isLength({ min: 2, max: 200 })
        .withMessage('Tên chứng chỉ phải từ 2-200 ký tự'),

      body('issuingOrganization')
        .notEmpty()
        .withMessage('Tổ chức cấp không được để trống')
        .isLength({ min: 2, max: 200 })
        .withMessage('Tổ chức cấp phải từ 2-200 ký tự'),

      body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Mô tả không được quá 500 ký tự'),

      body('issueDate')
        .isISO8601()
        .withMessage('Ngày cấp phải là định dạng ngày hợp lệ'),

      body('expiryDate')
        .optional()
        .isISO8601()
        .withMessage('Ngày hết hạn phải là định dạng ngày hợp lệ'),
    ];
  }

  /**
   * Validator cho tạo/cập nhật Achievement
   */
  static achievement(): ValidationChain[] {
    return [
      body('name')
        .notEmpty()
        .withMessage('Tên thành tích không được để trống')
        .isLength({ min: 2, max: 200 })
        .withMessage('Tên thành tích phải từ 2-200 ký tự'),

      body('level')
        .isIn(Object.values(AchievementLevel))
        .withMessage('Cấp độ thành tích không hợp lệ'),

      body('achievedDate')
        .isISO8601()
        .withMessage('Ngày đạt được phải là định dạng ngày hợp lệ'),

      body('awardingOrganization')
        .notEmpty()
        .withMessage('Tổ chức trao không được để trống')
        .isLength({ min: 2, max: 200 })
        .withMessage('Tổ chức trao phải từ 2-200 ký tự'),

      body('type')
        .isIn(Object.values(AchievementType))
        .withMessage('Loại thành tích không hợp lệ'),

      body('field')
        .notEmpty()
        .withMessage('Lĩnh vực không được để trống')
        .isLength({ min: 2, max: 100 })
        .withMessage('Lĩnh vực phải từ 2-100 ký tự'),

      body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Mô tả không được quá 500 ký tự'),
    ];
  }

  /**
   * Validator cho tạo yêu cầu xác thực
   */
  static verificationRequest(): ValidationChain[] {
    return [
      body('educationId')
        .optional()
        .isUUID(4)
        .withMessage('Education ID không hợp lệ (phải là UUID v4)'),

      body('certificateIds')
        .optional()
        .isArray()
        .withMessage('Certificate IDs phải là mảng'),

      body('certificateIds.*')
        .isUUID(4)
        .withMessage('Certificate ID không hợp lệ (phải là UUID v4)'),

      body('achievementIds')
        .optional()
        .isArray()
        .withMessage('Achievement IDs phải là mảng'),

      body('achievementIds.*')
        .isUUID(4)
        .withMessage('Achievement ID không hợp lệ (phải là UUID v4)'),
    ];
  }

  /**
   * Validator cho xử lý yêu cầu xác thực (admin)
   */
  static processVerificationRequest(): ValidationChain[] {
    return [
      param('id')
        .isUUID(4)
        .withMessage('Request ID không hợp lệ (phải là UUID v4)'),

      body('decisions')
        .isArray({ min: 1 })
        .withMessage('Phải có ít nhất một quyết định'),

      body('decisions.*.detailId')
        .isUUID(4)
        .withMessage('Detail ID không hợp lệ (phải là UUID v4)'),

      body('decisions.*.status')
        .isIn(['VERIFIED', 'REJECTED'])
        .withMessage('Status chỉ có thể là VERIFIED hoặc REJECTED'),

      body('decisions.*.rejectionReason')
        .if(body('decisions.*.status').equals('REJECTED'))
        .notEmpty()
        .withMessage('Phải có lý do từ chối'),

      body('adminNote')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Ghi chú admin không được quá 1000 ký tự'),
    ];
  }

  /**
   * Validator cho query parameters
   */
  static queryParams(): ValidationChain[] {
    return [
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page phải là số nguyên dương'),

      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit phải từ 1-100'),

      query('tutorId')
        .optional()
        .isUUID(4)
        .withMessage('Tutor ID không hợp lệ (phải là UUID v4)'),
    ];
  }

  /**
   * Validator cho UUID params
   */
  static uuidParam(paramName: string = 'id'): ValidationChain[] {
    return [
      param(paramName)
        .isUUID(4)
        .withMessage(`${paramName} không hợp lệ (phải là UUID v4)`),
    ];
  }

  /**
   * Validator cho MongoDB ObjectId params (deprecated - use uuidParam instead)
   */
  static mongoIdParam(paramName: string = 'id'): ValidationChain[] {
    return [
      param(paramName)
        .isUUID(4)
        .withMessage(`${paramName} không hợp lệ (phải là UUID v4)`),
    ];
  }
}
