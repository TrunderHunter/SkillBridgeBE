import { Request, Response } from 'express';
import { LearningClass } from '../../models/LearningClass';
import { logger } from '../../utils/logger';

/**
 * Check schedule conflict for both tutor and student
 */
export const checkScheduleConflict = async (req: Request, res: Response) => {
  try {
    const {
      tutorId,
      studentId,
      dayOfWeek, // Array of days: [1, 3, 5]
      startTime, // "19:00"
      endTime, // "20:30"
      startDate, // ISO date string
      excludeClassId, // Optional: exclude a specific class when editing
    } = req.body;

    // Validate input
    if (
      !tutorId ||
      !studentId ||
      !dayOfWeek ||
      !startTime ||
      !endTime ||
      !startDate
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    if (!Array.isArray(dayOfWeek) || dayOfWeek.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'dayOfWeek must be a non-empty array',
      });
    }

    const conflicts: {
      tutorConflicts: any[];
      studentConflicts: any[];
      hasConflict: boolean;
    } = {
      tutorConflicts: [],
      studentConflicts: [],
      hasConflict: false,
    };

    // Build query for active classes
    const baseQuery: any = {
      status: { $in: ['ACTIVE', 'PAUSED'] },
      $or: [
        { actualEndDate: { $exists: false } },
        { actualEndDate: { $gt: new Date(startDate) } },
      ],
    };

    if (excludeClassId) {
      baseQuery._id = { $ne: excludeClassId };
    }

    // Check tutor's schedule
    const tutorClasses = await LearningClass.find({
      ...baseQuery,
      tutorId,
    })
      .select(
        'title schedule startDate expectedEndDate actualEndDate studentId'
      )
      .populate('studentId', 'full_name')
      .lean();

    // Check student's schedule
    const studentClasses = await LearningClass.find({
      ...baseQuery,
      studentId,
    })
      .select('title schedule startDate expectedEndDate actualEndDate tutorId')
      .populate('tutorId', 'full_name')
      .lean();

    // Helper function to check time overlap
    const checkTimeOverlap = (
      start1: string,
      end1: string,
      start2: string,
      end2: string
    ): boolean => {
      const [h1, m1] = start1.split(':').map(Number);
      const [h2, m2] = end1.split(':').map(Number);
      const [h3, m3] = start2.split(':').map(Number);
      const [h4, m4] = end2.split(':').map(Number);

      const start1Mins = h1 * 60 + m1;
      const end1Mins = h2 * 60 + m2;
      const start2Mins = h3 * 60 + m3;
      const end2Mins = h4 * 60 + m4;

      return start1Mins < end2Mins && end1Mins > start2Mins;
    };

    // Check tutor conflicts
    for (const learningClass of tutorClasses) {
      const existingSchedule = learningClass.schedule;

      // Check if there's any common day
      const commonDays = dayOfWeek.filter((day: number) =>
        existingSchedule.dayOfWeek.includes(day)
      );

      if (commonDays.length > 0) {
        // Check time overlap
        const isTimeOverlap = checkTimeOverlap(
          startTime,
          endTime,
          existingSchedule.startTime,
          existingSchedule.endTime
        );

        if (isTimeOverlap) {
          const dayNames = [
            'Chủ nhật',
            'Thứ hai',
            'Thứ ba',
            'Thứ tư',
            'Thứ năm',
            'Thứ sáu',
            'Thứ bảy',
          ];

          conflicts.tutorConflicts.push({
            classId: learningClass._id,
            className: learningClass.title,
            conflictingDays: commonDays.map((d) => dayNames[d]),
            existingTime: `${existingSchedule.startTime} - ${existingSchedule.endTime}`,
            studentName: (learningClass.studentId as any)?.full_name || 'N/A',
          });
        }
      }
    }

    // Check student conflicts
    for (const learningClass of studentClasses) {
      const existingSchedule = learningClass.schedule;

      // Check if there's any common day
      const commonDays = dayOfWeek.filter((day: number) =>
        existingSchedule.dayOfWeek.includes(day)
      );

      if (commonDays.length > 0) {
        // Check time overlap
        const isTimeOverlap = checkTimeOverlap(
          startTime,
          endTime,
          existingSchedule.startTime,
          existingSchedule.endTime
        );

        if (isTimeOverlap) {
          const dayNames = [
            'Chủ nhật',
            'Thứ hai',
            'Thứ ba',
            'Thứ tư',
            'Thứ năm',
            'Thứ sáu',
            'Thứ bảy',
          ];

          conflicts.studentConflicts.push({
            classId: learningClass._id,
            className: learningClass.title,
            conflictingDays: commonDays.map((d) => dayNames[d]),
            existingTime: `${existingSchedule.startTime} - ${existingSchedule.endTime}`,
            tutorName: (learningClass.tutorId as any)?.full_name || 'N/A',
          });
        }
      }
    }

    conflicts.hasConflict =
      conflicts.tutorConflicts.length > 0 ||
      conflicts.studentConflicts.length > 0;

    return res.status(200).json({
      success: true,
      data: conflicts,
    });
  } catch (error: any) {
    logger.error('Check schedule conflict error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to check schedule conflict',
    });
  }
};
