import express from 'express';
import { authenticateToken, requireAdmin, requireTutorOrAdmin } from '../../middlewares';

const router = express.Router();

// Protected routes examples

// User profile - requires authentication
router.get('/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Profile retrieved successfully',
    data: {
      user: req.user
    }
  });
});

// Admin only route
router.get('/admin/users', authenticateToken, requireAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'Admin route accessed successfully',
    data: {
      message: 'This is an admin-only endpoint',
      currentUser: req.user
    }
  });
});

// Tutor or Admin route
router.get('/tutor/dashboard', authenticateToken, requireTutorOrAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'Tutor dashboard accessed successfully',
    data: {
      message: 'This is a tutor or admin endpoint',
      currentUser: req.user
    }
  });
});

// User settings - requires authentication
router.put('/settings', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Settings updated successfully',
    data: {
      message: 'User settings would be updated here',
      currentUser: req.user,
      requestBody: req.body
    }
  });
});

export default router;
