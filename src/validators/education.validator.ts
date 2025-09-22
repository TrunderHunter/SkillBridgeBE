import { body, param } from 'express-validator';
import { EducationLevel } from '../models/Education';

export const createEducationValidator = [
  body('level')
    .isIn(Object.values(EducationLevel))
    .withMessage(
      `Level must be one of: ${Object.values(EducationLevel).join(', ')}`
    ),

  body('school')
    .trim()
    .notEmpty()
    .withMessage('School name is required')
    .isLength({ max: 200 })
    .withMessage('School name cannot exceed 200 characters'),

  body('major')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Major cannot exceed 100 characters'),

  body('start_year')
    .matches(/^\d{4}$/)
    .withMessage('Start year must be a valid 4-digit year')
    .custom((value) => {
      const year = parseInt(value);
      const currentYear = new Date().getFullYear();
      if (year < 1900 || year > currentYear) {
        throw new Error(`Start year must be between 1900 and ${currentYear}`);
      }
      return true;
    }),

  body('end_year')
    .matches(/^\d{4}$/)
    .withMessage('End year must be a valid 4-digit year')
    .custom((value, { req }) => {
      const endYear = parseInt(value);
      const startYear = parseInt(req.body.start_year);
      const currentYear = new Date().getFullYear();

      if (endYear < 1900 || endYear > currentYear + 10) {
        throw new Error(
          `End year must be between 1900 and ${currentYear + 10}`
        );
      }

      if (startYear && endYear <= startYear) {
        throw new Error('End year must be greater than start year');
      }

      return true;
    }),
];

export const updateEducationValidator = [
  param('educationId')
    .notEmpty()
    .withMessage('Education ID is required')
    .isLength({ min: 1 })
    .withMessage('Invalid education ID'),

  body('level')
    .optional()
    .isIn(Object.values(EducationLevel))
    .withMessage(
      `Level must be one of: ${Object.values(EducationLevel).join(', ')}`
    ),

  body('school')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('School name cannot be empty')
    .isLength({ max: 200 })
    .withMessage('School name cannot exceed 200 characters'),

  body('major')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Major cannot exceed 100 characters'),

  body('start_year')
    .optional()
    .matches(/^\d{4}$/)
    .withMessage('Start year must be a valid 4-digit year')
    .custom((value) => {
      if (value) {
        const year = parseInt(value);
        const currentYear = new Date().getFullYear();
        if (year < 1900 || year > currentYear) {
          throw new Error(`Start year must be between 1900 and ${currentYear}`);
        }
      }
      return true;
    }),

  body('end_year')
    .optional()
    .matches(/^\d{4}$/)
    .withMessage('End year must be a valid 4-digit year')
    .custom((value, { req }) => {
      if (value) {
        const endYear = parseInt(value);
        const currentYear = new Date().getFullYear();

        if (endYear < 1900 || endYear > currentYear + 10) {
          throw new Error(
            `End year must be between 1900 and ${currentYear + 10}`
          );
        }

        if (req.body.start_year) {
          const startYear = parseInt(req.body.start_year);
          if (endYear <= startYear) {
            throw new Error('End year must be greater than start year');
          }
        }
      }
      return true;
    }),
];

export const educationParamsValidator = [
  param('educationId')
    .notEmpty()
    .withMessage('Education ID is required')
    .isLength({ min: 1 })
    .withMessage('Invalid education ID'),
];
