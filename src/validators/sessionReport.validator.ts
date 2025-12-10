import { body, param, query, ValidationChain } from 'express-validator';

export const validateSessionReport = {
  // Validate creating a new report
  createReport: [
    body('classId')
      .notEmpty()
      .withMessage('ID lớp học không được để trống')
      .isString()
      .trim(),

    body('sessionNumber')
      .notEmpty()
      .withMessage('Số buổi học không được để trống')
      .isInt({ min: 1 })
      .withMessage('Số buổi học phải là số nguyên dương'),

    body('reportedAgainst')
      .notEmpty()
      .withMessage('Đối tượng bị báo cáo không được để trống')
      .isIn(['STUDENT', 'TUTOR'])
      .withMessage('Đối tượng bị báo cáo phải là STUDENT hoặc TUTOR'),

    body('description')
      .notEmpty()
      .withMessage('Nội dung báo cáo không được để trống')
      .isString()
      .trim()
      .isLength({ min: 10, max: 2000 })
      .withMessage('Nội dung báo cáo phải từ 10 đến 2000 ký tự'),

    body('priority')
      .optional()
      .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
      .withMessage('Mức độ ưu tiên không hợp lệ'),
  ] as ValidationChain[],

  // Validate getting reports with filters
  getReports: [
    query('status')
      .optional()
      .isIn(['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'])
      .withMessage('Trạng thái không hợp lệ'),

    query('priority')
      .optional()
      .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
      .withMessage('Mức độ ưu tiên không hợp lệ'),

    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Số trang phải là số nguyên dương'),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Số lượng bản ghi phải từ 1 đến 100'),

    query('classId').optional().isString().trim(),

    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Ngày bắt đầu không hợp lệ'),

    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Ngày kết thúc không hợp lệ'),
  ] as ValidationChain[],

  // Validate report ID parameter
  reportIdParam: [
    param('reportId')
      .notEmpty()
      .withMessage('ID báo cáo không được để trống')
      .isString()
      .trim(),
  ] as ValidationChain[],

  // Validate resolving a report (Admin)
  resolveReport: [
    body('decision')
      .notEmpty()
      .withMessage('Quyết định xử lý không được để trống')
      .isIn([
        'STUDENT_FAULT',
        'TUTOR_FAULT',
        'BOTH_FAULT',
        'NO_FAULT',
        'DISMISSED',
      ])
      .withMessage('Quyết định xử lý không hợp lệ'),

    body('message')
      .notEmpty()
      .withMessage('Nội dung thông báo xử lý không được để trống')
      .isString()
      .trim()
      .isLength({ min: 10, max: 2000 })
      .withMessage('Nội dung thông báo phải từ 10 đến 2000 ký tự'),
  ] as ValidationChain[],

  // Validate updating report status (Admin)
  updateStatus: [
    body('status')
      .notEmpty()
      .withMessage('Trạng thái không được để trống')
      .isIn(['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'])
      .withMessage('Trạng thái không hợp lệ'),
  ] as ValidationChain[],

  // Validate adding admin note
  addAdminNote: [
    body('note')
      .notEmpty()
      .withMessage('Nội dung ghi chú không được để trống')
      .isString()
      .trim()
      .isLength({ min: 5, max: 1000 })
      .withMessage('Nội dung ghi chú phải từ 5 đến 1000 ký tự'),
  ] as ValidationChain[],
};
