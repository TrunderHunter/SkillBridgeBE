import { getSocketInstance } from '../../config/socket';
import { logger } from '../../utils/logger';
import { Notification } from '../../models/Notification';

// Define notification types
export interface NotificationData {
  type: 'email' | 'push' | 'socket';
  userId: string;
  notificationType:
    | 'CONTACT_REQUEST'
    | 'CLASS_CREATED'
    | 'HOMEWORK_ASSIGNED'
    | 'HOMEWORK_SUBMITTED'
    | 'HOMEWORK_GRADED'
    | 'ATTENDANCE_MARKED'
    | 'CANCELLATION_REQUESTED'
    | 'CANCELLATION_RESPONDED'
    | 'MESSAGE'
    | 'SYSTEM'
    | 'CONTRACT_CREATED'
    | 'CONTRACT_APPROVED'
    | 'CONTRACT_REJECTED'
    | 'CONTRACT_EXPIRED'
    | 'CONTRACT_CANCELLED';
  title: string;
  message: string;
  data?: any;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  actionUrl?: string;
}

// Simple notification service without Redis/Queue
export class NotificationService {
  // Send notification directly without queue
  static async sendNotification(
    data: NotificationData
  ): Promise<{ success: boolean; userId: string; type: string }> {
    try {
      // Save notification to database
      const notification = await Notification.create({
        userId: data.userId,
        type: data.notificationType,
        title: data.title,
        message: data.message,
        data: data.data,
        priority: data.priority || 'normal',
        actionUrl: data.actionUrl,
        isRead: false,
      });

      // Send via specified channel
      switch (data.type) {
        case 'socket':
          const io = getSocketInstance();
          if (io) {
            const roomName = `notifications-${data.userId}`;
            const notificationPayload = {
              _id: String(notification._id),
              type: notification.type,
              title: notification.title,
              message: notification.message,
              data: notification.data,
              priority: notification.priority,
              actionUrl: notification.actionUrl,
              isRead: false,
              createdAt: notification.createdAt.toISOString(),
              userId: notification.userId, // userId is already a string
            };

            logger.info(`Sending socket notification to room: ${roomName}`);
            logger.info(
              `Notification payload:`,
              JSON.stringify(notificationPayload, null, 2)
            );

            io.to(roomName).emit('notification', notificationPayload);

            // Log room members for debugging
            const room = io.sockets.adapter.rooms.get(roomName);
            if (room) {
              logger.info(
                `Room ${roomName} has ${room.size} socket(s) connected`
              );
            } else {
              logger.warn(
                `Room ${roomName} does not exist - user may not be connected`
              );
            }

            logger.info(`Socket notification sent to user ${data.userId}`);
          } else {
            logger.error('Socket instance not available');
          }
          break;

        case 'email':
          // TODO: Implement email sending
          logger.info(`Email notification sent to user ${data.userId}`);
          break;

        case 'push':
          // TODO: Implement push notification
          logger.info(`Push notification sent to user ${data.userId}`);
          break;
      }

      return { success: true, userId: data.userId, type: data.type };
    } catch (error) {
      logger.error(
        `Failed to send ${data.type} notification for user ${data.userId}:`,
        error
      );
      throw error;
    }
  }

  // Mark notification as read
  static async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const result = await Notification.updateOne(
        { _id: notificationId, userId },
        { isRead: true, readAt: new Date() }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error(`Failed to mark notification as read:`, error);
      return false;
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await Notification.updateMany(
        { userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );
      return result.modifiedCount;
    } catch (error) {
      logger.error(`Failed to mark all notifications as read:`, error);
      return 0;
    }
  }

  // Get user notifications
  static async getUserNotifications(
    userId: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
  ) {
    try {
      const { page = 1, limit = 20, unreadOnly = false } = options;
      const skip = (page - 1) * limit;

      const query: any = { userId };
      if (unreadOnly) {
        query.isRead = false;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Notification.countDocuments(query),
        Notification.countDocuments({ userId, isRead: false }),
      ]);

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        unreadCount,
      };
    } catch (error) {
      logger.error(`Failed to get user notifications:`, error);
      throw error;
    }
  }

  // Delete notification
  static async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const result = await Notification.deleteOne({
        _id: notificationId,
        userId,
      });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error(`Failed to delete notification:`, error);
      return false;
    }
  }

  // Batch send notifications
  static async sendBatchNotifications(
    notifications: NotificationData[]
  ): Promise<void> {
    const promises = notifications.map((notification) =>
      this.sendNotification(notification).catch((error) => {
        logger.error(
          `Failed to send notification to user ${notification.userId}:`,
          error
        );
        return {
          success: false,
          userId: notification.userId,
          type: notification.type,
        };
      })
    );

    await Promise.allSettled(promises);
  }
}

// Export for backward compatibility
export const addNotificationJob = async (
  data: NotificationData
): Promise<{ success: boolean; userId: string; type: string }> => {
  return NotificationService.sendNotification(data);
};

export default NotificationService;
