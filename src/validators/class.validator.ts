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
  ] as ValidationChain[]
};