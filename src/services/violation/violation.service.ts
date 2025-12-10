import SessionReport from '../../models/SessionReport';
import { LearningClass } from '../../models';

export class ViolationService {
  /**
   * Get violation count for a single user
   */
  static async getUserViolationCount(userId: string): Promise<number> {
    try {
      // Simply count reports where user is in violatorUserIds
      const violations = await SessionReport.countDocuments({
        status: 'RESOLVED',
        violatorUserIds: userId,
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

      // Aggregate violations by violatorUserId
      const results = await SessionReport.aggregate([
        {
          $match: {
            status: 'RESOLVED',
            violatorUserIds: { $in: userIds },
          },
        },
        {
          $unwind: '$violatorUserIds',
        },
        {
          $match: {
            violatorUserIds: { $in: userIds },
          },
        },
        {
          $group: {
            _id: '$violatorUserIds',
            count: { $sum: 1 },
          },
        },
      ]);

      // Initialize all users with 0 count
      const violationCounts: Record<string, number> = {};
      userIds.forEach((id) => {
        violationCounts[id] = 0;
      });

      // Fill in actual counts
      results.forEach((result: any) => {
        violationCounts[result._id] = result.count;
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
      // Get all reports where user is violator
      const reports = await SessionReport.find({
        status: 'RESOLVED',
        violatorUserIds: userId,
      })
        .populate('classId', 'title')
        .sort({ createdAt: -1 })
        .lean();

      // Count by decision type (for this user specifically)
      let studentFaultCount = 0;
      let tutorFaultCount = 0;
      let bothFaultCount = 0;

      reports.forEach((report: any) => {
        const decision = report.resolution?.decision;
        switch (decision) {
          case 'STUDENT_FAULT':
            studentFaultCount++;
            break;
          case 'TUTOR_FAULT':
            tutorFaultCount++;
            break;
          case 'BOTH_FAULT':
            bothFaultCount++;
            break;
        }
      });

      const totalViolations = reports.length;

      return {
        total_violations: totalViolations,
        student_fault_count: studentFaultCount,
        tutor_fault_count: tutorFaultCount,
        both_fault_count: bothFaultCount,
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
      // Get all reports where user is violator
      const violations = await SessionReport.find({
        status: 'RESOLVED',
        violatorUserIds: userId,
      })
        .populate('classId', 'title')
        .sort({ createdAt: -1 })
        .lean();

      // Count by decision type
      const decisionCounts: any = {
        STUDENT_FAULT: 0,
        TUTOR_FAULT: 0,
        BOTH_FAULT: 0,
      };

      violations.forEach((report: any) => {
        const decision = report.resolution?.decision;
        if (decision && decisionCounts[decision] !== undefined) {
          decisionCounts[decision]++;
        }
      });

      return {
        violations: violations.map((v: any) => ({
          ...v,
          is_user_at_fault: true, // All reports in this query are where user is at fault
        })),
        summary: {
          total: violations.length,
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
        status: 'RESOLVED',
        violatorUserIds: { $exists: true, $ne: [] },
      });
      return count;
    } catch (error) {
      console.error('Error getting total violation count:', error);
      return 0;
    }
  }
}
