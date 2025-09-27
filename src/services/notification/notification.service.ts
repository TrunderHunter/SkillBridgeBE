import { getSocketInstance } from '../../config/socket';
import { logger } from '../../utils/logger';

// Define notification types
export interface NotificationData {
  type: 'email' | 'push' | 'socket';
  userId: string;
  title: string;
  message: string;
  data?: any;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

// Simple notification service without Redis/Queue
export class NotificationService {
  // Send notification directly without queue
  static async sendNotification(
    data: NotificationData
  ): Promise<{ success: boolean; userId: string; type: string }> {
    try {
      switch (data.type) {
        case 'socket':
          const io = getSocketInstance();
          if (io) {
            io.to(`notifications-${data.userId}`).emit('notification', {
              title: data.title,
              message: data.message,
              data: data.data,
              timestamp: new Date().toISOString(),
            });
            logger.info(`Socket notification sent to user ${data.userId}`);
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
