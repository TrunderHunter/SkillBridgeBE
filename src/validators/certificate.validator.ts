import { body, param } from 'express-validator';

export const createCertificateValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Certificate name is required')
    .isLength({ max: 200 })
    .withMessage('Certificate name cannot exceed 200 characters'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  body('issued_by')
    .trim()
    .notEmpty()
    .withMessage('Issuing organization is required')
    .isLength({ max: 200 })
    .withMessage('Issuing organization cannot exceed 200 characters'),

  body('issue_date')
    .optional()
    .isISO8601()
    .withMessage('Issue date must be a valid date')
    .custom((value) => {
      if (value) {
        const issueDate = new Date(value);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (issueDate > today) {
          throw new Error('Issue date cannot be in the future');
        }
      }
      return true;
    }),

  body('expiry_date')
    .optional()
    .isISO8601()
    .withMessage('Expiry date must be a valid date')
    .custom((value, { req }) => {
      if (value && req.body.issue_date) {
        const expiryDate = new Date(value);
        const issueDate = new Date(req.body.issue_date);

        if (expiryDate <= issueDate) {
          throw new Error('Expiry date must be after issue date');
        }
      }
      return true;
    }),
];

export const updateCertificateValidator = [
  param('certificateId')
    .notEmpty()
    .withMessage('Certificate ID is required')
    .isLength({ min: 1 })
    .withMessage('Invalid certificate ID'),

  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Certificate name cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Certificate name cannot exceed 200 characters'),

  body('description')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Description cannot be empty')
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  body('issued_by')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Issuing organization cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Issuing organization cannot exceed 200 characters'),

  body('issue_date')
    .optional()
    .custom((value) => {
      if (value !== null && value !== undefined && value !== '') {
        if (!value || !Date.parse(value)) {
          throw new Error('Issue date must be a valid date');
        }

        const issueDate = new Date(value);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (issueDate > today) {
          throw new Error('Issue date cannot be in the future');
        }
      }
      return true;
    }),

  body('expiry_date')
    .optional()
    .custom((value, { req }) => {
      if (value !== null && value !== undefined && value !== '') {
        if (!value || !Date.parse(value)) {
          throw new Error('Expiry date must be a valid date');
        }

        if (req.body.issue_date) {
          const expiryDate = new Date(value);
          const issueDate = new Date(req.body.issue_date);

          if (expiryDate <= issueDate) {
            throw new Error('Expiry date must be after issue date');
          }
        }
      }
      return true;
    }),
];

export const certificateParamsValidator = [
  param('certificateId')
    .notEmpty()
    .withMessage('Certificate ID is required')
    .isLength({ min: 1 })
    .withMessage('Invalid certificate ID'),
];
