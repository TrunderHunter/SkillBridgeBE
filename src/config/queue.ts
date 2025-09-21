import Queue from 'bull';
import { getSocketInstance } from './socket';
import { logger } from '../utils/logger';

// Notification queue configuration
const REDIS_CONFIG = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
};

// Create notification queue
export const notificationQueue = new Queue(
  'notification processing',
  REDIS_CONFIG
);

// Process notification jobs
notificationQueue.process('process-notification', async (job) => {
  const { type, userId, title, message, data } = job.data;

  try {
    switch (type) {
      case 'socket':
        const io = getSocketInstance();
        if (io) {
          io.to(`notifications-${userId}`).emit('notification', {
            title,
            message,
            data,
            timestamp: new Date().toISOString(),
          });
        }
        break;

      case 'email':
        // TODO: Implement email sending
        logger.info(`Email notification sent to user ${userId}`);
        break;

      case 'push':
        // TODO: Implement push notification
        logger.info(`Push notification sent to user ${userId}`);
        break;
    }

    return { success: true, userId, type };
  } catch (error) {
    logger.error(
      `Failed to process ${type} notification for user ${userId}:`,
      error
    );
    throw error;
  }
});

// Queue event handlers
notificationQueue.on('ready', () => {
  logger.info('✅ Notification queue is ready');
});

notificationQueue.on('error', (error) => {
  logger.error('❌ Notification queue error:', error);
});

notificationQueue.on('waiting', (jobId) => {
  logger.info(`📋 Job ${jobId} is waiting`);
});

notificationQueue.on('active', (job, jobPromise) => {
  logger.info(`⚡ Job ${job.id} started processing`);
});

notificationQueue.on('completed', (job, result) => {
  logger.info(`✅ Job ${job.id} completed`);
});

notificationQueue.on('failed', (job, err) => {
  logger.error(`❌ Job ${job?.id} failed:`, err);
});

notificationQueue.on('progress', (job, progress) => {
  logger.info(`📊 Job ${job.id} progress: ${progress}%`);
});

// Define job types
export interface NotificationJobData {
  type: 'email' | 'push' | 'socket';
  userId: string;
  title: string;
  message: string;
  data?: any;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

// Queue job options
export const JOB_OPTIONS = {
  removeOnComplete: 10, // Keep last 10 completed jobs
  removeOnFail: 5, // Keep last 5 failed jobs
  attempts: 3, // Retry failed jobs 3 times
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
};

// Add notification to queue
export const addNotificationJob = async (
  data: NotificationJobData,
  options?: any
): Promise<Queue.Job> => {
  const jobOptions = {
    ...JOB_OPTIONS,
    priority: getPriorityNumber(data.priority || 'normal'),
    ...options,
  };

  return notificationQueue.add('process-notification', data, jobOptions);
};

// Helper function to convert priority to number
const getPriorityNumber = (priority: string): number => {
  switch (priority) {
    case 'critical':
      return 10;
    case 'high':
      return 5;
    case 'normal':
      return 0;
    case 'low':
      return -5;
    default:
      return 0;
  }
};

export default notificationQueue;
