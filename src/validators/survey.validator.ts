import { body, ValidationChain } from 'express-validator';

/**
 * Validation rules cho AI Survey
 */
export const surveyValidation = {
  /**
   * Submit survey validation
   */
  submitSurvey: (): ValidationChain[] => [
    body('gradeLevel')
      .trim()
      .notEmpty().withMessage('Vui lòng chọn cấp độ học')
      .isIn([
        'Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9',
        'Lớp 10', 'Lớp 11', 'Lớp 12',
        'Đại học', 'Người đi làm'
      ]).withMessage('Cấp độ học không hợp lệ'),

    body('subjects')
      .isArray({ min: 1 }).withMessage('Vui lòng chọn ít nhất 1 môn học')
      .custom((subjects: string[]) => subjects.length <= 5)
      .withMessage('Chọn tối đa 5 môn học'),

    body('goals')
      .isArray({ min: 1 }).withMessage('Vui lòng chọn ít nhất 1 mục tiêu')
      .custom((goals: string[]) => {
        const validGoals = ['improve_grades', 'exam_prep', 'advanced_learning', 'foundation', 'certification'];
        return goals.every(g => validGoals.includes(g));
      }).withMessage('Mục tiêu không hợp lệ'),

    body('teachingMode')
      .trim()
      .notEmpty().withMessage('Vui lòng chọn hình thức học')
      .isIn(['ONLINE', 'OFFLINE', 'BOTH']).withMessage('Hình thức học không hợp lệ'),

    body('preferredTeachingStyle')
      .isArray({ min: 1 }).withMessage('Vui lòng chọn ít nhất 1 phong cách dạy')
      .custom((styles: string[]) => {
        const validStyles = ['traditional', 'interactive', 'practice', 'creative'];
        return styles.every(s => validStyles.includes(s));
      }).withMessage('Phong cách dạy không hợp lệ'),

    body('availableTime')
      .isArray({ min: 1 }).withMessage('Vui lòng chọn ít nhất 1 khung giờ')
      .custom((times: string[]) => {
        const validTimes = ['morning', 'afternoon', 'evening', 'weekend'];
        return times.every(t => validTimes.includes(t));
      }).withMessage('Khung giờ không hợp lệ'),

    body('budgetRange.min')
      .isInt({ min: 50000 }).withMessage('Ngân sách tối thiểu là 50,000 VNĐ'),

    body('budgetRange.max')
      .isInt({ max: 1000000 }).withMessage('Ngân sách tối đa là 1,000,000 VNĐ')
      .custom((max, { req }) => {
        return max >= req.body.budgetRange.min;
      }).withMessage('Ngân sách tối đa phải lớn hơn ngân sách tối thiểu'),

    body('learningPace')
      .trim()
      .notEmpty().withMessage('Vui lòng chọn tốc độ học')
      .isIn(['self_learner', 'need_guidance', 'fast_learner', 'steady_learner'])
      .withMessage('Tốc độ học không hợp lệ'),

    body('priorities.experience')
      .optional()
      .isInt({ min: 1, max: 5 }).withMessage('Mức ưu tiên phải từ 1-5'),

    body('priorities.communication')
      .optional()
      .isInt({ min: 1, max: 5 }).withMessage('Mức ưu tiên phải từ 1-5'),

    body('priorities.qualification')
      .optional()
      .isInt({ min: 1, max: 5 }).withMessage('Mức ưu tiên phải từ 1-5'),

    body('priorities.price')
      .optional()
      .isInt({ min: 1, max: 5 }).withMessage('Mức ưu tiên phải từ 1-5'),

    body('priorities.location')
      .optional()
      .isInt({ min: 1, max: 5 }).withMessage('Mức ưu tiên phải từ 1-5'),
  ],
};
