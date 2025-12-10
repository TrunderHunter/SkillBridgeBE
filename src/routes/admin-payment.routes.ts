import { Router } from 'express';
import {
  getAllPayments,
  getPaymentStats,
  getPaymentDetails,
  getPaymentByOrderId,
  exportPayments,
} from '../controllers/admin/admin-payment.controller';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticateToken, requireRole('ADMIN'));

/**
 * @route   GET /api/v1/admin/payments
 * @desc    Get all payments with filters and pagination
 * @access  Admin
 * @query   page, limit, status, paymentMethod, paymentType, startDate, endDate, search, sortBy, sortOrder
 */
router.get('/', getAllPayments);

/**
 * @route   GET /api/v1/admin/payments/stats
 * @desc    Get payment statistics
 * @access  Admin
 * @query   startDate, endDate
 */
router.get('/stats', getPaymentStats);

/**
 * @route   GET /api/v1/admin/payments/export
 * @desc    Export payments to CSV
 * @access  Admin
 * @query   status, startDate, endDate
 */
router.get('/export', exportPayments);

/**
 * @route   GET /api/v1/admin/payments/order/:orderId
 * @desc    Get payment by orderId
 * @access  Admin
 */
router.get('/order/:orderId', getPaymentByOrderId);

/**
 * @route   GET /api/v1/admin/payments/:paymentId
 * @desc    Get payment details by ID
 * @access  Admin
 */
router.get('/:paymentId', getPaymentDetails);

export default router;
