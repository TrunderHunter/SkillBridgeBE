import { body, query, param } from 'express-validator';

// Subject validators
export const createSubjectValidator = [
  body('name')
    .notEmpty()
    .withMessage('Subject name is required')
    .isLength({ max: 100 })
    .withMessage('Subject name must not exceed 100 characters')
    .trim(),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
    .trim(),

  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn([
      'TOAN_HOC',
      'KHOA_HOC_TU_NHIEN',
      'VAN_HOC_XA_HOI',
      'NGOAI_NGU',
      'KHAC',
    ])
    .withMessage('Invalid category'),
];

export const updateSubjectValidator = [
  param('id').isMongoId().withMessage('Invalid subject ID'),

  body('name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Subject name must not exceed 100 characters')
    .trim(),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
    .trim(),

  body('category')
    .optional()
    .isIn([
      'TOAN_HOC',
      'KHOA_HOC_TU_NHIEN',
      'VAN_HOC_XA_HOI',
      'NGOAI_NGU',
      'KHAC',
    ])
    .withMessage('Invalid category'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const subjectIdValidator = [
  param('id').isMongoId().withMessage('Invalid subject ID'),
];

export const searchSubjectValidator = [
  query('q')
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
];

export const getSubjectsValidator = [
  query('category')
    .optional()
    .isIn([
      'TOAN_HOC',
      'KHOA_HOC_TU_NHIEN',
      'VAN_HOC_XA_HOI',
      'NGOAI_NGU',
      'KHAC',
    ])
    .withMessage('Invalid category'),

  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

export const categoryValidator = [
  param('category')
    .isIn([
      'TOAN_HOC',
      'KHOA_HOC_TU_NHIEN',
      'VAN_HOC_XA_HOI',
      'NGOAI_NGU',
      'KHAC',
    ])
    .withMessage('Invalid category'),
];
