import { body, param, query } from 'express-validator';
import { PostStatus } from '../models/Post';

export const createPostValidator = [
  body('title')
    .notEmpty().withMessage('Tiêu đề không được để trống')
    .isString().withMessage('Tiêu đề phải là chuỗi')
    .isLength({ max: 200 }).withMessage('Tiêu đề không được vượt quá 200 ký tự'),
  
  body('content')
    .notEmpty().withMessage('Nội dung không được để trống')
    .isString().withMessage('Nội dung phải là chuỗi')
    .isLength({ max: 5000 }).withMessage('Nội dung không được vượt quá 5000 ký tự'),
  
  body('subjects')
    .isArray().withMessage('Môn học phải là một mảng')
    .notEmpty().withMessage('Phải có ít nhất một môn học')
    .custom((value) => {
      if (value.length > 10) {
        throw new Error('Không được chọn quá 10 môn học');
      }
      return true;
    }),
  
  body('grade_levels')
    .isArray().withMessage('Cấp độ lớp phải là một mảng')
    .notEmpty().withMessage('Phải có ít nhất một cấp độ lớp')
    .custom((value) => {
      if (value.length > 10) {
        throw new Error('Không được chọn quá 10 cấp độ lớp');
      }
      return true;
    }),
  
  body('location')
    .optional()
    .isString().withMessage('Địa điểm phải là chuỗi')
    .isLength({ max: 200 }).withMessage('Địa điểm không được vượt quá 200 ký tự'),
  
  body('is_online')
    .optional()
    .isBoolean().withMessage('Trạng thái online phải là boolean'),
  
  body('hourly_rate')
    .optional()
    .isObject().withMessage('Học phí phải là một đối tượng'),
  
  body('hourly_rate.min')
    .optional()
    .isNumeric().withMessage('Học phí tối thiểu phải là số')
    .custom((value) => {
      if (value < 0) {
        throw new Error('Học phí tối thiểu không được âm');
      }
      return true;
    }),
  
  body('hourly_rate.max')
    .optional()
    .isNumeric().withMessage('Học phí tối đa phải là số')
    .custom((value, { req }) => {
      if (value < 0) {
        throw new Error('Học phí tối đa không được âm');
      }
      if (req.body.hourly_rate?.min && value < req.body.hourly_rate.min) {
        throw new Error('Học phí tối đa phải lớn hơn hoặc bằng học phí tối thiểu');
      }
      return true;
    }),
  
  body('availability')
    .optional()
    .isString().withMessage('Thời gian rảnh phải là chuỗi')
    .isLength({ max: 500 }).withMessage('Thời gian rảnh không được vượt quá 500 ký tự'),
  
  body('requirements')
    .optional()
    .isString().withMessage('Yêu cầu phải là chuỗi')
    .isLength({ max: 1000 }).withMessage('Yêu cầu không được vượt quá 1000 ký tự'),
  
  body('expiry_date')
    .optional()
    .isISO8601().withMessage('Ngày hết hạn phải là định dạng ngày hợp lệ')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      if (date <= now) {
        throw new Error('Ngày hết hạn phải lớn hơn ngày hiện tại');
      }
      return true;
    }),
];

export const updatePostValidator = [
  param('id')
    .notEmpty().withMessage('ID bài đăng không được để trống')
    .isString().withMessage('ID bài đăng phải là chuỗi'),
  
  body('title')
    .optional()
    .isString().withMessage('Tiêu đề phải là chuỗi')
    .isLength({ max: 200 }).withMessage('Tiêu đề không được vượt quá 200 ký tự'),
  
  body('content')
    .optional()
    .isString().withMessage('Nội dung phải là chuỗi')
    .isLength({ max: 5000 }).withMessage('Nội dung không được vượt quá 5000 ký tự'),
  
  body('subjects')
    .optional()
    .isArray().withMessage('Môn học phải là một mảng')
    .notEmpty().withMessage('Phải có ít nhất một môn học')
    .custom((value) => {
      if (value.length > 10) {
        throw new Error('Không được chọn quá 10 môn học');
      }
      return true;
    }),
  
  body('grade_levels')
    .optional()
    .isArray().withMessage('Cấp độ lớp phải là một mảng')
    .notEmpty().withMessage('Phải có ít nhất một cấp độ lớp')
    .custom((value) => {
      if (value.length > 10) {
        throw new Error('Không được chọn quá 10 cấp độ lớp');
      }
      return true;
    }),
  
  body('location')
    .optional()
    .isString().withMessage('Địa điểm phải là chuỗi')
    .isLength({ max: 200 }).withMessage('Địa điểm không được vượt quá 200 ký tự'),
  
  body('is_online')
    .optional()
    .isBoolean().withMessage('Trạng thái online phải là boolean'),
  
  body('hourly_rate')
    .optional()
    .isObject().withMessage('Học phí phải là một đối tượng'),
  
  body('hourly_rate.min')
    .optional()
    .isNumeric().withMessage('Học phí tối thiểu phải là số')
    .custom((value) => {
      if (value < 0) {
        throw new Error('Học phí tối thiểu không được âm');
      }
      return true;
    }),
  
  body('hourly_rate.max')
    .optional()
    .isNumeric().withMessage('Học phí tối đa phải là số')
    .custom((value, { req }) => {
      if (value < 0) {
        throw new Error('Học phí tối đa không được âm');
      }
      if (req.body.hourly_rate?.min && value < req.body.hourly_rate.min) {
        throw new Error('Học phí tối đa phải lớn hơn hoặc bằng học phí tối thiểu');
      }
      return true;
    }),
  
  body('availability')
    .optional()
    .isString().withMessage('Thời gian rảnh phải là chuỗi')
    .isLength({ max: 500 }).withMessage('Thời gian rảnh không được vượt quá 500 ký tự'),
  
  body('requirements')
    .optional()
    .isString().withMessage('Yêu cầu phải là chuỗi')
    .isLength({ max: 1000 }).withMessage('Yêu cầu không được vượt quá 1000 ký tự'),
  
  body('expiry_date')
    .optional()
    .isISO8601().withMessage('Ngày hết hạn phải là định dạng ngày hợp lệ')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      if (date <= now) {
        throw new Error('Ngày hết hạn phải lớn hơn ngày hiện tại');
      }
      return true;
    }),
];

export const reviewPostValidator = [
  param('id')
    .notEmpty().withMessage('ID bài đăng không được để trống')
    .isString().withMessage('ID bài đăng phải là chuỗi'),
  
  body('status')
    .notEmpty().withMessage('Trạng thái không được để trống')
    .isIn([PostStatus.APPROVED, PostStatus.REJECTED])
    .withMessage('Trạng thái phải là APPROVED hoặc REJECTED'),
  
  body('admin_note')
    .optional()
    .isString().withMessage('Ghi chú phải là chuỗi')
    .isLength({ max: 1000 }).withMessage('Ghi chú không được vượt quá 1000 ký tự'),
];

export const getPostsValidator = [
  query('status')
    .optional()
    .isIn(Object.values(PostStatus))
    .withMessage('Trạng thái không hợp lệ'),
  
  query('is_online')
    .optional()
    .isBoolean().withMessage('Trạng thái online phải là boolean'),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Trang phải là số nguyên lớn hơn hoặc bằng 1'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Giới hạn phải là số nguyên từ 1 đến 100'),
  
  query('sort_order')
    .optional()
    .isIn(['asc', 'desc']).withMessage('Thứ tự sắp xếp phải là asc hoặc desc'),
];