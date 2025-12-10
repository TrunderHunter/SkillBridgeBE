import SessionReport from '../../models/SessionReport';
import { LearningClass } from '../../models';

export class ViolationService {
  /**
   * Get violation count for a single user
   */
  static async getUserViolationCount(userId: string): Promise<number> {
    try {
      // Get all classes where user is involved (as student or tutor)
      const classes = await LearningClass.find({
        $or: [{ student_id: userId }, { tutor_id: userId }],
      })
        .select('_id student_id tutor_id')
        .lean();

      if (classes.length === 0) {
        return 0;
      }

      const classIds = classes.map((c: any) => c._id);

      // Count reports where this user is at fault
      const violations = await SessionReport.countDocuments({
        class_id: { $in: classIds },
        'resolution.decision': {
          $in: ['STUDENT_FAULT', 'TUTOR_FAULT', 'BOTH_FAULT'],
        },
        $or: classes.flatMap((cls: any) => {
          const conditions = [];
          if (cls.student_id === userId) {
            conditions.push({
              class_id: cls._id,
              'resolution.decision': { $in: ['STUDENT_FAULT', 'BOTH_FAULT'] },
            });
          }
          if (cls.tutor_id === userId) {
            conditions.push({
              class_id: cls._id,
              'resolution.decision': { $in: ['TUTOR_FAULT', 'BOTH_FAULT'] },
            });
          }
          return conditions;
        }),
      });

      return violations;
    } catch (error) {
      console.error('Error getting user violation count:', error);
      return 0;
    }
  }

  /**
   * Get violation counts for multiple users at once (bulk operation)
   */
  static async getBulkViolationCounts(
    userIds: string[]
  ): Promise<Record<string, number>> {
    try {
      if (userIds.length === 0) {
        return {};
      }

      // Get all classes for these users
      const classes = await LearningClass.find({
        $or: [{ student_id: { $in: userIds } }, { tutor_id: { $in: userIds } }],
      })
        .select('_id student_id tutor_id')
        .lean();

      if (classes.length === 0) {
        return userIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {});
      }

      const classIds = classes.map((c: any) => c._id);

      // Get all resolved reports for these classes
      const reports = await SessionReport.find({
        class_id: { $in: classIds },
        'resolution.decision': {
          $in: ['STUDENT_FAULT', 'TUTOR_FAULT', 'BOTH_FAULT'],
        },
      })
        .select('class_id resolution.decision')
        .lean();

      // Create a map of class_id to class info
      const classMap = new Map(classes.map((c: any) => [c._id.toString(), c]));

      // Count violations per user
      const violationCounts: Record<string, number> = {};
      userIds.forEach((id) => {
        violationCounts[id] = 0;
      });

      reports.forEach((report: any) => {
        const classInfo: any = classMap.get(report.class_id.toString());
        if (!classInfo) return;

        const decision = report.resolution?.decision;
        const studentId = classInfo.student_id.toString();
        const tutorId = classInfo.tutor_id.toString();

        if (decision === 'STUDENT_FAULT' && userIds.includes(studentId)) {
          violationCounts[studentId] = (violationCounts[studentId] || 0) + 1;
        } else if (decision === 'TUTOR_FAULT' && userIds.includes(tutorId)) {
          violationCounts[tutorId] = (violationCounts[tutorId] || 0) + 1;
        } else if (decision === 'BOTH_FAULT') {
          if (userIds.includes(studentId)) {
            violationCounts[studentId] = (violationCounts[studentId] || 0) + 1;
          }
          if (userIds.includes(tutorId)) {
            violationCounts[tutorId] = (violationCounts[tutorId] || 0) + 1;
          }
        }
      });

      return violationCounts;
    } catch (error) {
      console.error('Error getting bulk violation counts:', error);
      return {};
    }
  }

  /**
   * Get detailed violation summary for a user
   */
  static async getUserViolationSummary(userId: string): Promise<any> {
    try {
      // Get all classes where user is involved
      const classes = await LearningClass.find({
        $or: [{ student_id: userId }, { tutor_id: userId }],
      })
        .select('_id student_id tutor_id')
        .lean();

      if (classes.length === 0) {
        return {
          total_violations: 0,
          student_fault_count: 0,
          tutor_fault_count: 0,
          both_fault_count: 0,
          no_fault_count: 0,
          dismissed_count: 0,
          recent_reports: [],
        };
      }

      const classIds = classes.map((c: any) => c._id);
      const isStudent = classes.some(
        (c: any) => c.student_id.toString() === userId
      );
      const isTutor = classes.some(
        (c: any) => c.tutor_id.toString() === userId
      );

      // Get all reports for these classes
      const reports = await SessionReport.find({
        class_id: { $in: classIds },
      })
        .populate('class_id', 'title')
        .populate('reporter_id', 'full_name avatar_url')
        .sort({ created_at: -1 })
        .lean();

      // Count by decision type
      let studentFaultCount = 0;
      let tutorFaultCount = 0;
      let bothFaultCount = 0;
      let noFaultCount = 0;
      let dismissedCount = 0;

      reports.forEach((report: any) => {
        const decision = report.resolution?.decision;
        const classInfo: any = classes.find(
          (c: any) => c._id.toString() === report.class_id._id?.toString()
        );

        if (!classInfo) return;

        const userIsStudent = classInfo.student_id.toString() === userId;
        const userIsTutor = classInfo.tutor_id.toString() === userId;

        switch (decision) {
          case 'STUDENT_FAULT':
            if (userIsStudent) studentFaultCount++;
            break;
          case 'TUTOR_FAULT':
            if (userIsTutor) tutorFaultCount++;
            break;
          case 'BOTH_FAULT':
            bothFaultCount++;
            break;
          case 'NO_FAULT':
            noFaultCount++;
            break;
          case 'DISMISSED':
            dismissedCount++;
            break;
        }
      });

      const totalViolations =
        studentFaultCount + tutorFaultCount + bothFaultCount;

      return {
        total_violations: totalViolations,
        student_fault_count: studentFaultCount,
        tutor_fault_count: tutorFaultCount,
        both_fault_count: bothFaultCount,
        no_fault_count: noFaultCount,
        dismissed_count: dismissedCount,
        recent_reports: reports.slice(0, 10), // Last 10 reports
      };
    } catch (error) {
      console.error('Error getting user violation summary:', error);
      throw error;
    }
  }

  /**
   * Get detailed violation history for a user
   */
  static async getUserViolationHistory(userId: string): Promise<any> {
    try {
      // Get all classes where user is involved
      const classes = await LearningClass.find({
        $or: [{ student_id: userId }, { tutor_id: userId }],
      })
        .select('_id student_id tutor_id title')
        .lean();

      if (classes.length === 0) {
        return {
          violations: [],
          summary: {
            total: 0,
            by_decision: {
              STUDENT_FAULT: 0,
              TUTOR_FAULT: 0,
              BOTH_FAULT: 0,
              NO_FAULT: 0,
              DISMISSED: 0,
            },
          },
        };
      }

      const classIds = classes.map((c: any) => c._id);

      // Get all reports where user is at fault
      const allReports = await SessionReport.find({
        class_id: { $in: classIds },
        'resolution.decision': { $exists: true },
      })
        .populate('class_id', 'title')
        .populate('reporter_id', 'full_name avatar_url email')
        .populate('reported_user_id', 'full_name avatar_url email')
        .sort({ created_at: -1 })
        .lean();

      // Filter reports where this user is at fault
      const violations: any[] = [];
      const decisionCounts: any = {
        STUDENT_FAULT: 0,
        TUTOR_FAULT: 0,
        BOTH_FAULT: 0,
        NO_FAULT: 0,
        DISMISSED: 0,
      };

      allReports.forEach((report: any) => {
        const classInfo: any = classes.find(
          (c: any) => c._id.toString() === report.class_id._id?.toString()
        );
        if (!classInfo) return;

        const userIsStudent = classInfo.student_id.toString() === userId;
        const userIsTutor = classInfo.tutor_id.toString() === userId;
        const decision = report.resolution?.decision;

        let isUserAtFault = false;

        if (decision === 'STUDENT_FAULT' && userIsStudent) {
          isUserAtFault = true;
          decisionCounts.STUDENT_FAULT++;
        } else if (decision === 'TUTOR_FAULT' && userIsTutor) {
          isUserAtFault = true;
          decisionCounts.TUTOR_FAULT++;
        } else if (decision === 'BOTH_FAULT') {
          isUserAtFault = true;
          decisionCounts.BOTH_FAULT++;
        } else if (decision === 'NO_FAULT') {
          decisionCounts.NO_FAULT++;
        } else if (decision === 'DISMISSED') {
          decisionCounts.DISMISSED++;
        }

        // Include all reports for this user's classes for transparency
        violations.push({
          ...report,
          is_user_at_fault: isUserAtFault,
          user_role_in_class: userIsStudent ? 'STUDENT' : 'TUTOR',
        });
      });

      return {
        violations,
        summary: {
          total: violations.filter((v) => v.is_user_at_fault).length,
          by_decision: decisionCounts,
        },
      };
    } catch (error) {
      console.error('Error getting user violation history:', error);
      throw error;
    }
  }

  /**
   * Get total violation count across all users
   */
  static async getTotalViolationCount(): Promise<number> {
    try {
      const count = await SessionReport.countDocuments({
        'resolution.decision': {
          $in: ['STUDENT_FAULT', 'TUTOR_FAULT', 'BOTH_FAULT'],
        },
      });
      return count;
    } catch (error) {
      console.error('Error getting total violation count:', error);
      return 0;
    }
  }
}
