import { Request, Response } from 'express';
import { NotificationService } from '../../services/notification/notification.service';
import { logger } from '../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export class NotificationController {
  /**
   * Get user notifications
   */
  static async getNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { page, limit, unreadOnly } = req.query;

      const result = await NotificationService.getUserNotifications(userId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        unreadOnly: unreadOnly === 'true',
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Không thể lấy thông báo',
      });
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { notificationId } = req.params;

      const success = await NotificationService.markAsRead(notificationId, userId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông báo',
        });
      }

      res.json({
        success: true,
        message: 'Đã đánh dấu đã đọc',
      });
    } catch (error: any) {
      logger.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Không thể cập nhật thông báo',
      });
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;

      const count = await NotificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: `Đã đánh dấu ${count} thông báo là đã đọc`,
        data: { count },
      });
    } catch (error: any) {
      logger.error('Mark all notifications as read error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Không thể cập nhật thông báo',
      });
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { notificationId } = req.params;

      const success = await NotificationService.deleteNotification(notificationId, userId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông báo',
        });
      }

      res.json({
        success: true,
        message: 'Đã xoá thông báo',
      });
    } catch (error: any) {
      logger.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Không thể xoá thông báo',
      });
    }
  }

  /**
   * Get unread count
   */
  static async getUnreadCount(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;

      const result = await NotificationService.getUserNotifications(userId, {
        page: 1,
        limit: 1,
      });

      res.json({
        success: true,
        data: {
          unreadCount: result.unreadCount,
        },
      });
    } catch (error: any) {
      logger.error('Get unread count error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Không thể lấy số thông báo chưa đọc',
      });
    }
  }

  /**
   * Register FCM token for push notifications
   */
  static async registerToken(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'FCM token is required',
        });
      }

      // TODO: Store FCM token in database for push notifications
      // For now, just log it
      logger.info(`FCM token registered for user ${userId}: ${token.substring(0, 20)}...`);

      res.json({
        success: true,
        message: 'FCM token registered successfully',
      });
    } catch (error: any) {
      logger.error('Register FCM token error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Không thể đăng ký FCM token',
      });
    }
  }
}
