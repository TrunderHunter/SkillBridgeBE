import { Router } from 'express';
import { AdminUserController } from '../../controllers/admin/admin-user.controller';
import {
  authenticateToken,
  requireAdmin,
} from '../../middlewares/auth.middleware';
import { body, param, query } from 'express-validator';
import { handleValidationErrors } from '../../middlewares/validation.middleware';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * Admin routes for managing users
 */

// Get all users with filters and pagination
router.get(
  '/users',
  [
    query('role').optional().isIn(['STUDENT', 'TUTOR']),
    query('status')
      .optional()
      .isIn(['active', 'locked', 'pending_verification']),
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sort_by')
      .optional()
      .isIn(['created_at', 'updated_at', 'full_name', 'violation_count']),
    query('sort_order').optional().isIn(['asc', 'desc']),
  ],
  handleValidationErrors,
  AdminUserController.getAllUsers
);

// Get user statistics
router.get('/users/stats/overview', AdminUserController.getUserStats);

// Get specific user details
router.get(
  '/users/:userId',
  [param('userId').isString().notEmpty()],
  handleValidationErrors,
  AdminUserController.getUserDetails
);

// Update user status (block/unblock)
router.patch(
  '/users/:userId/status',
  [
    param('userId').isString().notEmpty(),
    body('status').isIn(['active', 'locked', 'pending_verification']),
    body('reason').optional().isString(),
  ],
  handleValidationErrors,
  AdminUserController.updateUserStatus
);

// Get user violation history
router.get(
  '/users/:userId/violations',
  [param('userId').isString().notEmpty()],
  handleValidationErrors,
  AdminUserController.getUserViolations
);

// Update user information (admin override)
router.put(
  '/users/:userId',
  [
    param('userId').isString().notEmpty(),
    body('full_name').optional().isString().trim(),
    body('email').optional().isEmail(),
    body('phone_number')
      .optional()
      .matches(/^(\+84|0)[3|5|7|8|9][0-9]{8}$/),
    body('status')
      .optional()
      .isIn(['active', 'locked', 'pending_verification']),
    body('role').optional().isIn(['STUDENT', 'TUTOR']),
  ],
  handleValidationErrors,
  AdminUserController.updateUserInfo
);

export default router;
