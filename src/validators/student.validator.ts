import { body, param } from 'express-validator';

// Validation cho việc tạo student profile
export const createStudentProfileValidation = [
  body('full_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên phải có từ 2-100 ký tự')
    .notEmpty()
    .withMessage('Tên là bắt buộc'),

  body('date_of_birth')
    .optional()
    .isISO8601()
    .withMessage('Ngày sinh không hợp lệ')
    .custom((value) => {
      if (value && new Date(value) > new Date()) {
        throw new Error('Ngày sinh không được là tương lai');
      }
      return true;
    }),

  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Giới tính phải là male, female hoặc other'),

  body('phone_number')
    .optional()
    .matches(/^(\+84|0)[3|5|7|8|9][0-9]{8}$/)
    .withMessage('Số điện thoại không hợp lệ (phải là số điện thoại Việt Nam)'),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Địa chỉ không được quá 500 ký tự'),

  body('grade')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Lớp học không được quá 50 ký tự'),

  body('school')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Tên trường không được quá 200 ký tự'),

  body('subjects')
    .optional()
    .isArray()
    .withMessage('Danh sách môn học phải là một mảng')
    .custom((subjects) => {
      if (subjects && Array.isArray(subjects)) {
        for (const subject of subjects) {
          if (typeof subject !== 'string' || subject.length > 100) {
            throw new Error('Tên môn học phải là chuỗi và không quá 100 ký tự');
          }
        }
      }
      return true;
    }),

  body('learning_goals')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Mục tiêu học tập không được quá 1000 ký tự'),

  body('preferred_schedule')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Lịch học ưa thích không được quá 500 ký tự'),

  body('special_requirements')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Yêu cầu đặc biệt không được quá 1000 ký tự')
];

// Validation cho việc cập nhật student profile
export const updateStudentProfileValidation = [
  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên phải có từ 2-100 ký tự'),

  body('date_of_birth')
    .optional()
    .isISO8601()
    .withMessage('Ngày sinh không hợp lệ')
    .custom((value) => {
      if (value && new Date(value) > new Date()) {
        throw new Error('Ngày sinh không được là tương lai');
      }
      return true;
    }),

  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Giới tính phải là male, female hoặc other'),

  body('phone_number')
    .optional()
    .matches(/^(\+84|0)[3|5|7|8|9][0-9]{8}$/)
    .withMessage('Số điện thoại không hợp lệ'),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Địa chỉ không được quá 500 ký tự'),

  body('grade')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Lớp học không được quá 50 ký tự'),

  body('school')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Tên trường không được quá 200 ký tự'),

  body('subjects')
    .optional()
    .isArray()
    .withMessage('Danh sách môn học phải là một mảng'),

  body('learning_goals')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Mục tiêu học tập không được quá 1000 ký tự'),

  body('preferred_schedule')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Lịch học ưa thích không được quá 500 ký tự'),

  body('special_requirements')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Yêu cầu đặc biệt không được quá 1000 ký tự')
];

// Validation cho student ID parameter
export const studentIdValidation = [
  param('studentId')
    .notEmpty()
    .withMessage('Student ID là bắt buộc')
    .isLength({ min: 1 })
    .withMessage('Student ID không được để trống')
    .trim()
];