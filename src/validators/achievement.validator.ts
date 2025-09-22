import { body, param } from 'express-validator';
import { AchievementType, AchievementLevel } from '../models/Achievement';

export const createAchievementValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Achievement name is required')
    .isLength({ max: 200 })
    .withMessage('Achievement name cannot exceed 200 characters'),

  body('level')
    .isIn(Object.values(AchievementLevel))
    .withMessage(
      `Level must be one of: ${Object.values(AchievementLevel).join(', ')}`
    ),

  body('date_achieved')
    .isISO8601()
    .withMessage('Date achieved must be a valid date')
    .custom((value) => {
      const achievementDate = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (achievementDate > today) {
        throw new Error('Date achieved cannot be in the future');
      }

      const minDate = new Date('1900-01-01');
      if (achievementDate < minDate) {
        throw new Error('Date achieved cannot be before 1900');
      }

      return true;
    }),

  body('organization')
    .trim()
    .notEmpty()
    .withMessage('Organization is required')
    .isLength({ max: 200 })
    .withMessage('Organization cannot exceed 200 characters'),

  body('type')
    .isIn(Object.values(AchievementType))
    .withMessage(
      `Type must be one of: ${Object.values(AchievementType).join(', ')}`
    ),

  body('field')
    .trim()
    .notEmpty()
    .withMessage('Field is required')
    .isLength({ max: 100 })
    .withMessage('Field cannot exceed 100 characters'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
];

export const updateAchievementValidator = [
  param('achievementId')
    .notEmpty()
    .withMessage('Achievement ID is required')
    .isLength({ min: 1 })
    .withMessage('Invalid achievement ID'),

  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Achievement name cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Achievement name cannot exceed 200 characters'),

  body('level')
    .optional()
    .isIn(Object.values(AchievementLevel))
    .withMessage(
      `Level must be one of: ${Object.values(AchievementLevel).join(', ')}`
    ),

  body('date_achieved')
    .optional()
    .isISO8601()
    .withMessage('Date achieved must be a valid date')
    .custom((value) => {
      if (value) {
        const achievementDate = new Date(value);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (achievementDate > today) {
          throw new Error('Date achieved cannot be in the future');
        }

        const minDate = new Date('1900-01-01');
        if (achievementDate < minDate) {
          throw new Error('Date achieved cannot be before 1900');
        }
      }
      return true;
    }),

  body('organization')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Organization cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Organization cannot exceed 200 characters'),

  body('type')
    .optional()
    .isIn(Object.values(AchievementType))
    .withMessage(
      `Type must be one of: ${Object.values(AchievementType).join(', ')}`
    ),

  body('field')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Field cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Field cannot exceed 100 characters'),

  body('description')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Description cannot be empty')
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
];

export const achievementParamsValidator = [
  param('achievementId')
    .notEmpty()
    .withMessage('Achievement ID is required')
    .isLength({ min: 1 })
    .withMessage('Invalid achievement ID'),
];
