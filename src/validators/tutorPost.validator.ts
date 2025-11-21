import { body, query, param } from 'express-validator';

// Helper function để validate time format HH:mm
const isValidTimeFormat = (time: string) => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

// Helper function để validate teaching schedule
const validateTeachingSchedule = (schedules: any[]) => {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return false;
  }

  for (const schedule of schedules) {
    if (
      typeof schedule.dayOfWeek !== 'number' ||
      schedule.dayOfWeek < 0 ||
      schedule.dayOfWeek > 6 ||
      !isValidTimeFormat(schedule.startTime) ||
      !isValidTimeFormat(schedule.endTime)
    ) {
      return false;
    }

    // Check if endTime is after startTime
    const [startHour, startMin] = schedule.startTime.split(':').map(Number);
    const [endHour, endMin] = schedule.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      return false;
    }
  }

  return true;
};

// TutorPost validators
export const createTutorPostValidator = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 150 })
    .withMessage('Title must not exceed 150 characters')
    .trim(),

  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters')
    .trim(),

  body('subjects')
    .isArray({ min: 1 })
    .withMessage('At least one subject is required')
    .custom((subjects) => {
      return subjects.every(
        (subject: string) => typeof subject === 'string' && subject.length > 0
      );
    })
    .withMessage('All subjects must be valid IDs'),

  body('pricePerSession')
    .isInt({ min: 100000, max: 10000000 })
    .withMessage(
      'Price per session must be between 100,000 and 10,000,000 VND'
    ),

  body('sessionDuration')
    .isIn([60, 90, 120, 150, 180])
    .withMessage('Session duration must be 60, 90, 120, 150, or 180 minutes'),

  body('teachingMode')
    .isIn(['ONLINE', 'OFFLINE', 'BOTH'])
    .withMessage('Teaching mode must be ONLINE, OFFLINE, or BOTH'),

  body('studentLevel')
    .isArray({ min: 1 })
    .withMessage('At least one student level is required')
    .custom((levels) => {
      const validLevels = [
        'TIEU_HOC',
        'TRUNG_HOC_CO_SO',
        'TRUNG_HOC_PHO_THONG',
        'DAI_HOC',
        'NGUOI_DI_LAM',
        'KHAC',
      ];
      return levels.every((level: string) => validLevels.includes(level));
    })
    .withMessage('Invalid student level'),

  body('teachingSchedule')
    .custom(validateTeachingSchedule)
    .withMessage('Invalid teaching schedule format'),

  // Address validation (conditional)
  body('address')
    .if(body('teachingMode').isIn(['OFFLINE', 'BOTH']))
    .notEmpty()
    .withMessage('Address is required for offline teaching'),

  body('address.province')
    .if(body('teachingMode').isIn(['OFFLINE', 'BOTH']))
    .notEmpty()
    .withMessage('Province is required'),

  body('address.district')
    .if(body('teachingMode').isIn(['OFFLINE', 'BOTH']))
    .notEmpty()
    .withMessage('District is required'),

  body('address.ward')
    .if(body('teachingMode').isIn(['OFFLINE', 'BOTH']))
    .notEmpty()
    .withMessage('Ward is required'),

  body('address.specificAddress')
    .if(body('teachingMode').isIn(['OFFLINE', 'BOTH']))
    .notEmpty()
    .withMessage('Specific address is required')
    .isLength({ max: 200 })
    .withMessage('Specific address must not exceed 200 characters'),
];

export const updateTutorPostValidator = [
  param('postId').isUUID().withMessage('Invalid post ID'),

  body('title')
    .optional()
    .isLength({ max: 150 })
    .withMessage('Title must not exceed 150 characters')
    .trim(),

  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters')
    .trim(),

  body('subjects')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one subject is required if provided')
    .custom((subjects) => {
      return subjects.every(
        (subject: string) => typeof subject === 'string' && subject.length > 0
      );
    })
    .withMessage('All subjects must be valid IDs'),

  body('pricePerSession')
    .optional()
    .isInt({ min: 100000, max: 10000000 })
    .withMessage(
      'Price per session must be between 100,000 and 10,000,000 VND'
    ),

  body('sessionDuration')
    .optional()
    .isIn([60, 90, 120, 150, 180])
    .withMessage('Session duration must be 60, 90, 120, 150, or 180 minutes'),

  body('teachingMode')
    .optional()
    .isIn(['ONLINE', 'OFFLINE', 'BOTH'])
    .withMessage('Teaching mode must be ONLINE, OFFLINE, or BOTH'),

  body('studentLevel')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one student level is required if provided')
    .custom((levels) => {
      const validLevels = [
        'TIEU_HOC',
        'TRUNG_HOC_CO_SO',
        'TRUNG_HOC_PHO_THONG',
        'DAI_HOC',
        'NGUOI_DI_LAM',
        'KHAC',
      ];
      return levels.every((level: string) => validLevels.includes(level));
    })
    .withMessage('Invalid student level'),

  body('teachingSchedule')
    .optional()
    .custom(validateTeachingSchedule)
    .withMessage('Invalid teaching schedule format'),
];

export const postIdValidator = [
  param('postId').isUUID().withMessage('Invalid post ID'),
];

export const searchTutorPostsValidator = [
  query('subjects')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        const subjects = value.split(',');
        return subjects.every((id) => id.trim().length > 0);
      }
      return true;
    })
    .withMessage('Invalid subjects format'),

  query('teachingMode')
    .optional()
    .isIn(['ONLINE', 'OFFLINE', 'BOTH'])
    .withMessage('Invalid teaching mode'),

  query('studentLevel')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        const levels = value.split(',');
        const validLevels = [
          'TIEU_HOC',
          'TRUNG_HOC_CO_SO',
          'TRUNG_HOC_PHO_THONG',
          'DAI_HOC',
          'NGUOI_DI_LAM',
          'KHAC',
        ];
        return levels.every((level) => validLevels.includes(level.trim()));
      }
      return true;
    })
    .withMessage('Invalid student level'),

  query('priceMin')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Price min must be a non-negative integer'),

  query('priceMax')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Price max must be a non-negative integer'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),

  query('sortBy')
    .optional()
    .isIn(['createdAt', 'pricePerSession', 'viewCount', 'rating'])
    .withMessage('Invalid sort field'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),

  query('minRating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('minRating must be between 0 and 5'),

  query('minReviews')
    .optional()
    .isInt({ min: 0 })
    .withMessage('minReviews must be a non-negative integer'),
];

export const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
];
