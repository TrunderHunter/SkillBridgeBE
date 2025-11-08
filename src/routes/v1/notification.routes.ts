import { Router } from 'express';
import { NotificationController } from '../../controllers/notification/notification.controller';
import { authenticateToken } from '../../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get notifications
router.get('/', NotificationController.getNotifications);

// Get unread count
router.get('/unread-count', NotificationController.getUnreadCount);

// Mark as read
router.patch('/:notificationId/read', NotificationController.markAsRead);

// Mark all as read
router.patch('/mark-all-read', NotificationController.markAllAsRead);

// Delete notification
router.delete('/:notificationId', NotificationController.deleteNotification);

export default router;
