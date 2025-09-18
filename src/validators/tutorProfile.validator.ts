import { body, ValidationChain } from 'express-validator';
import { Gender } from '../types/user.types';

export const validateTutorProfile = {
  updatePersonalInfo: [
    body('full_name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Họ và tên phải có từ 2 đến 100 ký tự'),

    body('phone_number')
      .optional()
      .matches(/^(\+84|0)[3|5|7|8|9][0-9]{8}$/)
      .withMessage('Vui lòng nhập số điện thoại Việt Nam hợp lệ'),

    body('gender')
      .optional()
      .isIn(Object.values(Gender))
      .withMessage('Giới tính phải là nam, nữ hoặc khác'),

    body('date_of_birth')
      .optional()
      .isISO8601()
      .toDate()
      .withMessage('Vui lòng nhập ngày sinh hợp lệ (định dạng: YYYY-MM-DD)')
      .custom((value) => {
        if (!value) return true; // Optional field

        const now = new Date();
        const birthDate = new Date(value);
        const age = now.getFullYear() - birthDate.getFullYear();

        if (birthDate > now) {
          throw new Error('Ngày sinh không hợp lệ');
        }

        if (age < 18 || age > 100) {
          throw new Error('Tuổi phải từ 18 đến 100 tuổi');
        }

        return true;
      }),

    body('address')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Địa chỉ không được vượt quá 500 ký tự'),
  ] as ValidationChain[],

  updateIntroduction: [
    body('headline')
      .optional()
      .trim()
      .isLength({ max: 150 })
      .withMessage('Tiêu đề không được vượt quá 150 ký tự'),

    body('introduction')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Phần giới thiệu không được vượt quá 2000 ký tự'),

    body('teaching_experience')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Kinh nghiệm giảng dạy không được vượt quá 1000 ký tự'),

    body('student_levels')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Trình độ học viên không được vượt quá 500 ký tự'),

    body('video_intro_link')
      .optional()
      .trim()
      .custom((value) => {
        // Nếu giá trị rỗng thì cho phép
        if (!value || value === '') {
          return true;
        }

        // Nếu có giá trị thì phải là URL hợp lệ
        const urlRegex =
          /^https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:\#(?:[\w.])*)?)?$/;
        if (!urlRegex.test(value)) {
          throw new Error('Vui lòng nhập URL hợp lệ cho video giới thiệu');
        }

        return true;
      }),
  ] as ValidationChain[],
};
