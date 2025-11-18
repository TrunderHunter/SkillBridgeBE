import { LearningClass } from '../../models/LearningClass';
import { Notification } from '../../models/Notification';
import { logger } from '../../utils/logger';
import NotificationService from '../notification/notification.service';

interface AssignmentReminder {
  classId: string;
  sessionNumber: number;
  assignmentTitle: string;
  deadline: Date;
  studentId: string;
  tutorId: string;
  studentName: string;
  tutorName: string;
  className: string;
  hoursUntilDeadline: number;
}

/**
 * Service to check and send deadline reminders for assignments
 */
export class AssignmentReminderService {
  /**
   * Check assignments that are approaching deadline
   * @param hoursBeforeDeadline - Number of hours before deadline to send reminder (default: 24)
   * @returns Array of assignments that need reminders
   */
  static async checkUpcomingDeadlines(
    hoursBeforeDeadline: number = 24
  ): Promise<AssignmentReminder[]> {
    try {
      const now = new Date();
      const reminderTime = new Date(now.getTime() + hoursBeforeDeadline * 60 * 60 * 1000);

      // Find all classes with assignments that have deadlines within the reminder window
      const classes = await LearningClass.find({
        'sessions.homework.assignment.deadline': {
          $gte: now,
          $lte: reminderTime,
        },
        status: 'ACTIVE',
      })
        .populate('studentId', 'full_name email')
        .populate('tutorId', 'full_name email')
        .populate('subject', 'name')
        .lean();

      const reminders: AssignmentReminder[] = [];

      classes.forEach((learningClass: any) => {
        learningClass.sessions.forEach((session: any) => {
          const assignment = session.homework?.assignment;
          const submission = session.homework?.submission;

          // Only send reminder if assignment exists, has deadline, and hasn't been submitted yet
          if (assignment && assignment.deadline && !submission) {
            const deadline = new Date(assignment.deadline);
            const hoursUntilDeadline = Math.floor(
              (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
            );

            // Only include if deadline is within the reminder window and not passed
            if (deadline >= now && deadline <= reminderTime) {
              reminders.push({
                classId: learningClass._id.toString(),
                sessionNumber: session.sessionNumber,
                assignmentTitle: assignment.title,
                deadline,
                studentId:
                  typeof learningClass.studentId === 'object'
                    ? learningClass.studentId._id.toString()
                    : learningClass.studentId.toString(),
                tutorId:
                  typeof learningClass.tutorId === 'object'
                    ? learningClass.tutorId._id.toString()
                    : learningClass.tutorId.toString(),
                studentName:
                  typeof learningClass.studentId === 'object'
                    ? learningClass.studentId.full_name || 'Học viên'
                    : 'Học viên',
                tutorName:
                  typeof learningClass.tutorId === 'object'
                    ? learningClass.tutorId.full_name || 'Giáo viên'
                    : 'Giáo viên',
                className:
                  typeof learningClass.subject === 'object'
                    ? learningClass.subject.name || learningClass.title
                    : learningClass.title,
                hoursUntilDeadline,
              });
            }
          }
        });
      });

      logger.info(
        `Found ${reminders.length} assignments with deadlines approaching within ${hoursBeforeDeadline} hours`
      );

      return reminders;
    } catch (error) {
      logger.error('Error checking upcoming deadlines:', error);
      throw error;
    }
  }

  /**
   * Check if reminder was already sent to avoid duplicates
   */
  static async wasReminderSent(
    userId: string,
    classId: string,
    sessionNumber: number,
    deadline: Date
  ): Promise<boolean> {
    try {
      // Check if notification was sent in the last 12 hours for this assignment
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

      const existingNotification = await Notification.findOne({
        userId,
        type: 'ASSIGNMENT_DEADLINE_REMINDER',
        'data.classId': classId,
        'data.sessionNumber': sessionNumber,
        'data.deadline': deadline.toISOString(),
        createdAt: { $gte: twelveHoursAgo },
      });

      return !!existingNotification;
    } catch (error) {
      logger.error('Error checking if reminder was sent:', error);
      return false;
    }
  }

  /**
   * Send deadline reminder to student
   */
  static async sendStudentReminder(reminder: AssignmentReminder): Promise<boolean> {
    try {
      // Check if reminder was already sent
      const alreadySent = await this.wasReminderSent(
        reminder.studentId,
        reminder.classId,
        reminder.sessionNumber,
        reminder.deadline
      );

      if (alreadySent) {
        logger.info(
          `Reminder already sent to student ${reminder.studentId} for assignment ${reminder.assignmentTitle}`
        );
        return false;
      }

      // Format deadline message
      const deadlineDate = new Date(reminder.deadline);
      const deadlineStr = deadlineDate.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      let message = '';
      let priority: 'low' | 'normal' | 'high' | 'critical' = 'normal';

      if (reminder.hoursUntilDeadline <= 6) {
        message = `⚠️ Còn ${reminder.hoursUntilDeadline} giờ nữa là đến hạn nộp bài "${reminder.assignmentTitle}" (${deadlineStr})`;
        priority = 'critical';
      } else if (reminder.hoursUntilDeadline <= 12) {
        message = `⏰ Còn ${reminder.hoursUntilDeadline} giờ nữa là đến hạn nộp bài "${reminder.assignmentTitle}" (${deadlineStr})`;
        priority = 'high';
      } else {
        message = `📅 Còn ${reminder.hoursUntilDeadline} giờ nữa là đến hạn nộp bài "${reminder.assignmentTitle}" (${deadlineStr})`;
        priority = 'normal';
      }

      await NotificationService.sendNotification({
        type: 'socket',
        userId: reminder.studentId,
        notificationType: 'ASSIGNMENT_DEADLINE_REMINDER',
        title: 'Nhắc nhở deadline bài tập',
        message,
        priority,
        actionUrl: `/student/assignments`,
        data: {
          classId: reminder.classId,
          sessionNumber: reminder.sessionNumber,
          assignmentTitle: reminder.assignmentTitle,
          deadline: reminder.deadline.toISOString(),
          hoursUntilDeadline: reminder.hoursUntilDeadline,
          className: reminder.className,
        },
      });

      logger.info(
        `Sent deadline reminder to student ${reminder.studentId} for assignment "${reminder.assignmentTitle}"`
      );

      return true;
    } catch (error) {
      logger.error('Error sending student reminder:', error);
      return false;
    }
  }

  /**
   * Send deadline reminder to tutor (to remind them to check submissions)
   */
  static async sendTutorReminder(reminder: AssignmentReminder): Promise<boolean> {
    try {
      // Check if reminder was already sent
      const alreadySent = await this.wasReminderSent(
        reminder.tutorId,
        reminder.classId,
        reminder.sessionNumber,
        reminder.deadline
      );

      if (alreadySent) {
        logger.info(
          `Reminder already sent to tutor ${reminder.tutorId} for assignment ${reminder.assignmentTitle}`
        );
        return false;
      }

      // Only send to tutor if deadline is very close (within 6 hours) or passed
      const now = new Date();
      const deadline = new Date(reminder.deadline);
      const hoursUntilDeadline = Math.floor(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
      );

      // Only send reminder if deadline is within 6 hours or has passed
      if (hoursUntilDeadline > 6) {
        return false;
      }

      const deadlineDate = new Date(reminder.deadline);
      const deadlineStr = deadlineDate.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      let message = '';
      let priority: 'low' | 'normal' | 'high' | 'critical' = 'normal';

      if (hoursUntilDeadline <= 0) {
        message = `⚠️ Đã quá hạn nộp bài "${reminder.assignmentTitle}" của học viên ${reminder.studentName} (${deadlineStr})`;
        priority = 'high';
      } else {
        message = `⏰ Còn ${hoursUntilDeadline} giờ nữa là đến hạn nộp bài "${reminder.assignmentTitle}" của học viên ${reminder.studentName} (${deadlineStr})`;
        priority = 'normal';
      }

      await NotificationService.sendNotification({
        type: 'socket',
        userId: reminder.tutorId,
        notificationType: 'ASSIGNMENT_DEADLINE_REMINDER',
        title: 'Nhắc nhở deadline bài tập',
        message,
        priority,
        actionUrl: `/tutor/assignments`,
        data: {
          classId: reminder.classId,
          sessionNumber: reminder.sessionNumber,
          assignmentTitle: reminder.assignmentTitle,
          deadline: reminder.deadline.toISOString(),
          hoursUntilDeadline,
          className: reminder.className,
          studentName: reminder.studentName,
        },
      });

      logger.info(
        `Sent deadline reminder to tutor ${reminder.tutorId} for assignment "${reminder.assignmentTitle}"`
      );

      return true;
    } catch (error) {
      logger.error('Error sending tutor reminder:', error);
      return false;
    }
  }

  /**
   * Process all upcoming deadlines and send reminders
   */
  static async processDeadlineReminders(hoursBeforeDeadline: number = 24): Promise<void> {
    try {
      logger.info(`Starting deadline reminder check (${hoursBeforeDeadline} hours before deadline)`);

      const reminders = await this.checkUpcomingDeadlines(hoursBeforeDeadline);

      if (reminders.length === 0) {
        logger.info('No assignments with upcoming deadlines found');
        return;
      }

      let studentRemindersSent = 0;
      let tutorRemindersSent = 0;

      // Send reminders to students
      for (const reminder of reminders) {
        const sent = await this.sendStudentReminder(reminder);
        if (sent) {
          studentRemindersSent++;
        }

        // Small delay to avoid overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Send reminders to tutors (only for deadlines within 6 hours)
      for (const reminder of reminders) {
        const sent = await this.sendTutorReminder(reminder);
        if (sent) {
          tutorRemindersSent++;
        }

        // Small delay to avoid overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      logger.info(
        `Deadline reminder process completed: ${studentRemindersSent} student reminders, ${tutorRemindersSent} tutor reminders sent`
      );
    } catch (error) {
      logger.error('Error processing deadline reminders:', error);
      throw error;
    }
  }
}

