import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { AssignmentReminderService } from '../services/assignmentReminder/assignmentReminder.service';

/**
 * Cron job scheduler for background tasks
 */
export class CronScheduler {
  private static jobs: cron.ScheduledTask[] = [];

  /**
   * Initialize all cron jobs
   */
  static initialize(): void {
    logger.info('🕐 Initializing cron scheduler...');

    // Schedule deadline reminder check every 30 minutes
    // Giúp bắt được các deadline tương đối gần mà không bỏ sót
    const deadlineReminderJob = cron.schedule('*/30 * * * *', async () => {
      try {
        logger.info('⏰ Running deadline reminder check...');
        await AssignmentReminderService.processDeadlineReminders(24); // Check for deadlines within 24 hours
      } catch (error) {
        logger.error('Error in deadline reminder cron job:', error);
      }
    });

    this.jobs.push(deadlineReminderJob);
    logger.info('✅ Deadline reminder cron job scheduled (runs every hour)');

    // Schedule additional reminder check for urgent deadlines (within 6 hours)
    // Chạy thường xuyên hơn để nhắc các deadline rất gần
    const urgentReminderJob = cron.schedule('*/5 * * * *', async () => {
      try {
        logger.info('🚨 Running urgent deadline reminder check...');
        await AssignmentReminderService.processDeadlineReminders(6); // Check for deadlines within 6 hours
      } catch (error) {
        logger.error('Error in urgent deadline reminder cron job:', error);
      }
    });

    this.jobs.push(urgentReminderJob);
    logger.info('✅ Urgent deadline reminder cron job scheduled (runs every 30 minutes)');

    logger.info(`✅ Cron scheduler initialized with ${this.jobs.length} jobs`);
  }

  /**
   * Stop all cron jobs
   */
  static stop(): void {
    logger.info('🛑 Stopping cron scheduler...');
    this.jobs.forEach((job) => job.stop());
    this.jobs = [];
    logger.info('✅ All cron jobs stopped');
  }

  /**
   * Get status of all cron jobs
   */
  static getStatus(): { running: number; total: number } {
    // node-cron doesn't have getStatus method, so we check if job is in the array
    return {
      running: this.jobs.length, // All jobs in array are considered running
      total: this.jobs.length,
    };
  }
}

