import express from 'express';
import { paymentController } from '../../controllers/paymentSchedule/payment.controller';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { studentMiddleware } from '../../middlewares/student.middleware';
import { validatePayment } from '../../validators/payment.validator';
import { validationMiddleware } from '../../middlewares/validation.middleware';

const router = express.Router();

/**
 * Payment Routes
 * Base path: /api/v1/payments
 */

/**
 * @route POST /api/v1/payments/initiate
 * @desc Initiate payment for selected sessions
 * @access Student only
 */
router.post(
  '/initiate',
  authenticateToken,
  studentMiddleware,
  ...validatePayment.initiatePayment,
  validationMiddleware,
  paymentController.initiatePayment
);

/**
 * @route GET /api/v1/payments/vnpay/return
 * @desc VNPay return callback (no auth required)
 * @access Public (called by VNPay)
 */
router.get('/vnpay/return', paymentController.vnpayReturn);

/**
 * @route GET /api/v1/payments/history
 * @desc Get student's payment history
 * @access Student only
 * NOTE: Must be BEFORE /:orderId to avoid matching "history" as orderId
 */
router.get(
  '/history',
  authenticateToken,
  studentMiddleware,
  ...validatePayment.getPaymentHistory,
  validationMiddleware,
  paymentController.getPaymentHistory
);

/**
 * @route GET /api/v1/payments/classes/:learningClassId/available-sessions
 * @desc Get available sessions for payment
 * @access Student only
 */
router.get(
  '/classes/:learningClassId/available-sessions',
  authenticateToken,
  studentMiddleware,
  ...validatePayment.getAvailableSessions,
  validationMiddleware,
  paymentController.getAvailableSessions
);

/**
 * @route GET /api/v1/payments/classes/:learningClassId/pending
 * @desc Get pending payment for a class (if exists)
 * @access Student only
 */
router.get(
  '/classes/:learningClassId/pending',
  authenticateToken,
  studentMiddleware,
  paymentController.getPendingPayment
);

/**
 * @route GET /api/v1/payments/:orderId
 * @desc Get payment details by order ID
 * @access Student or Tutor (must be related to the payment)
 * NOTE: Must be AFTER specific routes to avoid catching them
 */
router.get(
  '/:orderId',
  authenticateToken,
  ...validatePayment.getPaymentByOrderId,
  validationMiddleware,
  paymentController.getPaymentByOrderId
);

/**
 * @route POST /api/v1/payments/:orderId/reprocess
 * @desc Force reprocess a payment (fix stuck payments)
 * @access Student only (owner)
 */
router.post(
  '/:orderId/reprocess',
  authenticateToken,
  studentMiddleware,
  paymentController.reprocessPayment
);

/**
 * TEST ROUTE - Only for development/testing
 * @route GET /api/v1/payments/test/create-simple
 * @desc Create a simple test payment URL without complex body
 * @access Public (no auth required)
 */
if (
  process.env.NODE_ENV === 'development' ||
  process.env.VNPAY_TEST_MODE === 'true'
) {
  router.get('/test/create-simple', paymentController.testCreateSimplePayment);
}

export { router as paymentRoutes };
