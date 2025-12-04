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
      }),
    body('templateId')
      .optional()
      .isString()
      .withMessage('templateId không hợp lệ'),
    body('rubricId')
      .optional()
      .isString()
      .withMessage('rubricId không hợp lệ'),
  ] as ValidationChain[],

  submitHomework: [
    body('assignmentId')
      .optional()
      .isString()
      .withMessage('assignmentId không hợp lệ'),
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
      .withMessage('Ghi chú không được vượt quá 500 ký tự'),
    body('textAnswer')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Bài viết không được vượt quá 5000 ký tự'),
    body('audioUrl')
      .optional()
      .isURL()
      .withMessage('URL audio không hợp lệ'),
  ] as ValidationChain[],

  gradeHomework: [
    body('assignmentId')
      .optional()
      .isString()
      .withMessage('assignmentId không hợp lệ'),
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
  ] as ValidationChain[],

  createMaterial: [
    body('title')
      .notEmpty()
      .withMessage('Tiêu đề không được để trống')
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Tiêu đề không được vượt quá 200 ký tự'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Mô tả không được vượt quá 1000 ký tự'),
    body('fileUrl')
      .notEmpty()
      .withMessage('Vui lòng cung cấp file tải lên')
      .isURL()
      .withMessage('URL file không hợp lệ'),
    body('fileName')
      .optional()
      .isString()
      .trim(),
    body('fileSize')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Dung lượng file không hợp lệ'),
    body('visibility')
      .optional()
      .isIn(['STUDENTS', 'PRIVATE'])
      .withMessage('Kiểu hiển thị không hợp lệ')
  ] as ValidationChain[],

  updateMaterial: [
    body('title')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Tiêu đề không được vượt quá 200 ký tự'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Mô tả không được vượt quá 1000 ký tự'),
    body('fileUrl')
      .optional()
      .isURL()
      .withMessage('URL file không hợp lệ'),
    body('fileName')
      .optional()
      .isString()
      .trim(),
    body('fileSize')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Dung lượng file không hợp lệ'),
    body('visibility')
      .optional()
      .isIn(['STUDENTS', 'PRIVATE'])
      .withMessage('Kiểu hiển thị không hợp lệ')
  ] as ValidationChain[],

  createAssignment: [
    body('title')
      .notEmpty()
      .withMessage('Tiêu đề không được để trống')
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Tiêu đề không được vượt quá 200 ký tự'),
    body('instructions')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Hướng dẫn không được vượt quá 2000 ký tự'),
    body('dueDate')
      .optional()
      .isISO8601()
      .withMessage('Hạn nộp phải là ngày hợp lệ'),
    body('attachment.fileUrl')
      .optional()
      .isURL()
      .withMessage('URL file đính kèm không hợp lệ'),
    body('attachment.fileName')
      .optional()
      .isString()
      .trim(),
    body('attachment.fileSize')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Dung lượng file không hợp lệ')
  ] as ValidationChain[],

  updateAssignment: [
    body('title')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Tiêu đề không được vượt quá 200 ký tự'),
    body('instructions')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Hướng dẫn không được vượt quá 2000 ký tự'),
    body('dueDate')
      .optional()
      .isISO8601()
      .withMessage('Hạn nộp phải là ngày hợp lệ'),
    body('attachment.fileUrl')
      .optional({ checkFalsy: true })
      .isURL()
      .withMessage('URL file đính kèm không hợp lệ'),
    body('attachment.fileName')
      .optional({ checkFalsy: true })
      .isString()
      .trim(),
    body('attachment.fileSize')
      .optional({ checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage('Dung lượng file không hợp lệ')
  ] as ValidationChain[],

  submitAssignmentWork: [
    body('fileUrl')
      .notEmpty()
      .withMessage('File bài nộp không được để trống')
      .isURL()
      .withMessage('URL file không hợp lệ'),
    body('note')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Ghi chú không được vượt quá 500 ký tự'),
    body('fileName')
      .optional()
      .isString()
      .trim(),
    body('fileSize')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Dung lượng file không hợp lệ')
  ] as ValidationChain[]
};