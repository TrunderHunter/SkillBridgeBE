import { body, ValidationChain } from 'express-validator';

export const validateClass = {
  updateStatus: [
    body('status')
      .isIn(['ACTIVE', 'COMPLETED', 'CANCELLED', 'PAUSED'])
      .withMessage('Trạng thái không hợp lệ')
  ] as ValidationChain[],

  addReview: [
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Đánh giá phải từ 1 đến 5 sao'),
    
    body('review')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Nội dung đánh giá không được vượt quá 1000 ký tự')
  ] as ValidationChain[],

  addFeedback: [
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Đánh giá phải từ 1 đến 5 sao'),
    
    body('feedback')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Nội dung đánh giá không được vượt quá 1000 ký tự')
  ] as ValidationChain[],

  assignHomework: [
    body('title')
      .notEmpty()
      .withMessage('Tiêu đề bài tập không được để trống')
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Tiêu đề không được vượt quá 200 ký tự'),
    
    body('description')
      .notEmpty()
      .withMessage('Mô tả bài tập không được để trống')
      .isString()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Mô tả không được vượt quá 2000 ký tự'),
    
    body('fileUrl')
      .optional()
      .isURL()
      .withMessage('URL file không hợp lệ'),
    
    body('deadline')
      .notEmpty()
      .withMessage('Hạn nộp bài không được để trống')
      .isISO8601()
      .withMessage('Hạn nộp bài phải là ngày hợp lệ')
      .custom((value) => {
        if (new Date(value) <= new Date()) {
          throw new Error('Hạn nộp bài phải sau thời điểm hiện tại');
        }
        return true;
      })
  ] as ValidationChain[],

  submitHomework: [
    body('fileUrl')
      .notEmpty()
      .withMessage('File bài làm không được để trống')
      .isURL()
      .withMessage('URL file không hợp lệ'),
    
    body('notes')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Ghi chú không được vượt quá 500 ký tự')
  ] as ValidationChain[],

  gradeHomework: [
    body('score')
      .notEmpty()
      .withMessage('Điểm không được để trống')
      .isFloat({ min: 0, max: 10 })
      .withMessage('Điểm phải từ 0 đến 10'),
    
    body('feedback')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Nhận xét không được vượt quá 1000 ký tự')
  ] as ValidationChain[]
};