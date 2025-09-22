import { Router } from 'express';
import { VerificationController } from '../../controllers/verification';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { handleValidationErrors } from '../../middlewares/validation.middleware';
import { body, param } from 'express-validator';

const router = Router();

// All verification routes require authentication
router.use(authenticateToken);

// Tutor routes
// POST /verification/request - Create verification request
router.post('/request', VerificationController.createVerificationRequest);

// GET /verification/status - Get current verification status
router.get('/status', VerificationController.getVerificationStatus);

// GET /verification/history - Get verification history
router.get('/history', VerificationController.getVerificationHistory);

// Admin routes
// GET /verification/pending - Get all pending verification requests
router.get(
  '/pending',
  // TODO: Add admin role middleware here
  VerificationController.getPendingRequests
);

// GET /verification/:requestId - Get verification request details
router.get(
  '/:requestId',
  [
    param('requestId')
      .notEmpty()
      .withMessage('Request ID is required')
      .isLength({ min: 1 })
      .withMessage('Invalid request ID'),
  ],
  handleValidationErrors,
  // TODO: Add admin role middleware here
  VerificationController.getVerificationRequestDetails
);

// PUT /verification/:requestId/approve - Approve verification request
router.put(
  '/:requestId/approve',
  [
    param('requestId')
      .notEmpty()
      .withMessage('Request ID is required')
      .isLength({ min: 1 })
      .withMessage('Invalid request ID'),
    body('feedback')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Feedback cannot exceed 500 characters'),
  ],
  handleValidationErrors,
  // TODO: Add admin role middleware here
  VerificationController.approveVerificationRequest
);

// PUT /verification/:requestId/reject - Reject verification request
router.put(
  '/:requestId/reject',
  [
    param('requestId')
      .notEmpty()
      .withMessage('Request ID is required')
      .isLength({ min: 1 })
      .withMessage('Invalid request ID'),
    body('feedback')
      .trim()
      .notEmpty()
      .withMessage('Feedback is required for rejection')
      .isLength({ min: 10, max: 500 })
      .withMessage('Feedback must be between 10 and 500 characters'),
  ],
  handleValidationErrors,
  // TODO: Add admin role middleware here
  VerificationController.rejectVerificationRequest
);

export default router;
