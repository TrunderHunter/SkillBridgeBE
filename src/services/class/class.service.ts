import {
  LearningClass,
  ISessionHomeworkAssignment,
} from '../../models/LearningClass';
import { User } from '../../models/User';
import { Subject } from '../../models/Subject';
import { Contract } from '../../models/Contract';
import { TutorProfile } from '../../models/TutorProfile';
import { logger } from '../../utils/logger';
import { buildJitsiModeratorUrl } from '../meeting/meeting.service';
import {
  notifyHomeworkAssigned,
  notifyHomeworkSubmitted,
  notifyHomeworkGraded,
  notifyCancellationRequested,
  notifyCancellationResponded,
} from '../notification/notification.helpers';
import { v4 as uuidv4 } from 'uuid';
import { speechToTextService } from '../ai/speechToText.service';

const LEGACY_ASSIGNMENT_PREFIX = 'legacy-session';

type AssignmentStatus = 'pending' | 'submitted' | 'graded';

interface SessionAssignmentView {
  id: string;
  title: string;
  description?: string;
  fileUrl?: string;
  deadline?: Date;
  assignedAt?: Date;
  submission?: {
    fileUrl: string;
    notes?: string;
    submittedAt: Date;
    textAnswer?: string;
    audioUrl?: string;
    speakingTranscript?: string;
  };
  grade?: {
    score: number;
    feedback?: string;
    gradedAt: Date;
  };
  templateId?: string;
  status: AssignmentStatus;
  isLate: boolean;
  isLegacy?: boolean;
}

interface SessionHomeworkSummary {
  hasAssignment: boolean;
  hasSubmission: boolean;
  hasGrade: boolean;
  totalAssignments: number;
  totalSubmitted: number;
  totalGraded: number;
  isLate: boolean;
  assignments: SessionAssignmentView[];
}

type AssignmentResolveResult =
  | { mode: 'array'; assignment: any }
  | { mode: 'legacy'; assignment: any }
  | null;

const toPlainObject = (value: any) => {
  if (!value) return value;
  return typeof value.toObject === 'function'
    ? value.toObject()
    : JSON.parse(JSON.stringify(value));
};

const buildSessionAssignmentList = (session: any): SessionAssignmentView[] => {
  if (!session?.homework) return [];

  const assignments = Array.isArray(session.homework.assignments)
    ? session.homework.assignments
    : [];

  const normalized = assignments.map((assignment: any) => {
    const plain = toPlainObject(assignment);
    const submission = plain.submission
      ? toPlainObject(plain.submission)
      : undefined;
    const grade = plain.grade ? toPlainObject(plain.grade) : undefined;
    const deadline = plain.deadline ? new Date(plain.deadline) : undefined;
    const submissionDate = submission?.submittedAt
      ? new Date(submission.submittedAt)
      : undefined;
    const isLate =
      submissionDate && deadline ? submissionDate > deadline : false;

    return {
      id: plain._id || plain.id,
      title: plain.title,
      description: plain.description,
      fileUrl: plain.fileUrl,
      deadline: plain.deadline,
      assignedAt: plain.assignedAt,
      submission,
      grade,
      templateId: plain.templateId,
      status: grade ? 'graded' : submission ? 'submitted' : 'pending',
      isLate: Boolean(isLate),
      isLegacy: !!plain.isLegacy,
    };
  });

  if (!normalized.length && session.homework.assignment) {
    const legacyAssignment = toPlainObject(session.homework.assignment);
    const legacySubmission = session.homework.submission
      ? toPlainObject(session.homework.submission)
      : undefined;
    const legacyGrade = session.homework.grade
      ? toPlainObject(session.homework.grade)
      : undefined;
    const deadline = legacyAssignment.deadline
      ? new Date(legacyAssignment.deadline)
      : undefined;
    const submissionDate = legacySubmission?.submittedAt
      ? new Date(legacySubmission.submittedAt)
      : undefined;
    const isLate =
      submissionDate && deadline ? submissionDate > deadline : false;

    normalized.push({
      id: `${LEGACY_ASSIGNMENT_PREFIX}-${session.sessionNumber}`,
      title: legacyAssignment.title,
      description: legacyAssignment.description,
      fileUrl: legacyAssignment.fileUrl,
      deadline: legacyAssignment.deadline,
      assignedAt: legacyAssignment.assignedAt,
      submission: legacySubmission,
      grade: legacyGrade,
      status: legacyGrade
        ? 'graded'
        : legacySubmission
          ? 'submitted'
          : 'pending',
      isLate: Boolean(isLate),
      isLegacy: true,
    });
  }

  return normalized;
};

const summarizeSessionHomework = (session: any): SessionHomeworkSummary => {
  const assignments = buildSessionAssignmentList(session);
  const totalAssignments = assignments.length;
  const totalSubmitted = assignments.filter((a) => !!a.submission).length;
  const totalGraded = assignments.filter((a) => !!a.grade).length;
  const hasAssignment = totalAssignments > 0;
  const hasSubmission = totalSubmitted > 0;
  const hasGrade = totalGraded > 0;
  const isLate = assignments.some((a) => a.isLate);

  return {
    hasAssignment,
    hasSubmission,
    hasGrade,
    totalAssignments,
    totalSubmitted,
    totalGraded,
    isLate,
    assignments,
  };
};

const resolveSessionAssignment = (
  session: any,
  assignmentId?: string
): AssignmentResolveResult => {
  if (!session?.homework) return null;

  const assignments = Array.isArray(session.homework.assignments)
    ? session.homework.assignments
    : [];

  if (assignmentId) {
    const directMatch = assignments.find(
      (assignment: any) => assignment._id?.toString() === assignmentId
    );
    if (directMatch) {
      return { mode: 'array', assignment: directMatch };
    }

    if (
      assignmentId.startsWith(LEGACY_ASSIGNMENT_PREFIX) &&
      session.homework.assignment
    ) {
      return { mode: 'legacy', assignment: session.homework };
    }

    return null;
  }

  if (assignments.length === 1) {
    return { mode: 'array', assignment: assignments[0] };
  }

  if (!assignments.length && session.homework.assignment) {
    return { mode: 'legacy', assignment: session.homework };
  }

  return null;
};

class ClassService {
  /**
   * Get tutor's classes
   */
  async getTutorClasses(tutorId: string) {
    try {
      const classes = await LearningClass.find({ tutorId })
        .populate('studentId', 'full_name avatar_url email phone_number')
        .populate('subject', 'name')
        .sort({ createdAt: -1 });

      return {
        success: true,
        data: classes,
      };
    } catch (error: any) {
      logger.error('Get tutor classes error:', error);
      throw new Error('Không thể lấy danh sách lớp học');
    }
  }

  /**
   * Get student's classes
   */
  async getStudentClasses(studentId: string) {
    try {
      const classes = await LearningClass.find({ studentId })
        .populate('tutorId', 'full_name avatar_url email phone_number')
        .populate('subject', 'name')
        .sort({ createdAt: -1 });

      return {
        success: true,
        data: classes,
      };
    } catch (error: any) {
      logger.error('Get student classes error:', error);
      throw new Error('Không thể lấy danh sách lớp học');
    }
  }

  /**
   * Get class details by ID
   */
  async getClassById(classId: string, userId: string) {
    try {
      // First, get the raw document to check if IDs exist
      const rawClass = await LearningClass.findById(classId).lean();

      if (!rawClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Get populated version
      const learningClass = await LearningClass.findById(classId)
        .populate('tutorId', 'full_name avatar_url email phone_number')
        .populate('studentId', 'full_name avatar_url email phone_number')
        .populate('subject', 'name')
        .populate('contactRequestId');

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Check if user is authorized to view this class
      // Use raw IDs from database if populate failed
      const rawTutorId = rawClass.tutorId?.toString() || null;
      const rawStudentId = rawClass.studentId?.toString() || null;

      // Extract tutorId - prefer populated, fallback to raw
      let tutorId: string | null = null;
      if (learningClass.tutorId) {
        if (
          typeof learningClass.tutorId === 'object' &&
          learningClass.tutorId !== null
        ) {
          tutorId =
            (learningClass.tutorId as any)._id?.toString() ||
            (learningClass.tutorId as any).id?.toString() ||
            null;
        } else {
          tutorId = String(learningClass.tutorId);
        }
      }

      // If populate failed, use raw ID
      if (!tutorId && rawTutorId) {
        tutorId = rawTutorId;
      }

      // Extract studentId - prefer populated, fallback to raw
      let studentId: string | null = null;
      if (learningClass.studentId) {
        if (
          typeof learningClass.studentId === 'object' &&
          learningClass.studentId !== null
        ) {
          studentId =
            (learningClass.studentId as any)._id?.toString() ||
            (learningClass.studentId as any).id?.toString() ||
            null;
        } else {
          studentId = String(learningClass.studentId);
        }
      }

      // If populate failed, use raw ID
      if (!studentId && rawStudentId) {
        studentId = rawStudentId;
      }

      // Check if IDs are valid
      if (!tutorId) {
        throw new Error('Lớp học không có thông tin gia sư');
      }
      if (!studentId) {
        throw new Error('Lớp học không có thông tin học viên');
      }

      if (tutorId !== userId && studentId !== userId) {
        throw new Error('Bạn không có quyền xem thông tin lớp học này');
      }

      return {
        success: true,
        data: learningClass,
      };
    } catch (error: any) {
      logger.error('Get class details error:', error);
      throw new Error(error.message || 'Không thể lấy thông tin lớp học');
    }
  }

  /**
   * Get moderator join link for online class (tutor only)
   */
  async getModeratorJoinLink(
    classId: string,
    tutorId: string,
    opts?: { displayName?: string; email?: string; sessionNumber?: number }
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      if (learningClass.tutorId.toString() !== tutorId) {
        throw new Error('Chỉ gia sư của lớp mới có quyền lấy link quản trị');
      }

      if (learningClass.learningMode !== 'ONLINE') {
        throw new Error('Lớp học này không phải học online');
      }

      // Check payment status if sessionNumber is provided
      if (opts?.sessionNumber) {
        const session = learningClass.sessions.find(
          (s) => s.sessionNumber === opts.sessionNumber
        );

        if (!session) {
          throw new Error('Không tìm thấy buổi học');
        }

        // Check if payment is required and if session is paid
        if (session.paymentRequired && session.paymentStatus !== 'PAID') {
          throw new Error(
            'Buổi học này chưa được thanh toán. Vui lòng thanh toán trước khi tham gia.'
          );
        }
      }

      const onlineInfo: any = learningClass.onlineInfo || {};
      const roomName =
        onlineInfo?.meetingId ||
        (() => {
          const link: string | undefined = onlineInfo?.meetingLink;
          if (!link) return undefined;
          try {
            const url = new URL(link);
            const segments = url.pathname.split('/').filter(Boolean);
            return segments[segments.length - 1];
          } catch {
            return undefined;
          }
        })();

      if (!roomName) {
        throw new Error('Không tìm thấy thông tin phòng họp');
      }

      const moderatorUrl = buildJitsiModeratorUrl({
        roomName,
        displayName: opts?.displayName,
        email: opts?.email,
      });

      if (!moderatorUrl) {
        throw new Error('Thiếu cấu hình Jitsi JaaS để tạo link quản trị');
      }

      return {
        success: true,
        data: { moderatorUrl },
      };
    } catch (error: any) {
      logger.error('Get moderator join link error:', error);
      throw new Error(error.message || 'Không thể lấy link quản trị');
    }
  }

  /**
   * Update class status
   */
  async updateClassStatus(classId: string, status: string, userId: string) {
    try {
      const learningClass = await LearningClass.findById(classId);

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Only tutor can update class status
      if (learningClass.tutorId.toString() !== userId) {
        throw new Error('Bạn không có quyền cập nhật trạng thái lớp học này');
      }

      // Validate status
      if (!['ACTIVE', 'CANCELLED', 'PAUSED'].includes(status)) {
        throw new Error('Trạng thái không hợp lệ');
      }

      // Tutor cannot manually mark class as COMPLETED.
      // Class completion is handled automatically when all sessions are done.
      learningClass.status = status as 'ACTIVE' | 'CANCELLED' | 'PAUSED';

      await learningClass.save();

      return {
        success: true,
        message: 'Cập nhật trạng thái lớp học thành công',
        data: learningClass,
      };
    } catch (error: any) {
      logger.error('Update class status error:', error);
      throw new Error(error.message || 'Không thể cập nhật trạng thái lớp học');
    }
  }

  /**
   * Add student review for class
   */
  async addStudentReview(
    classId: string,
    studentId: string,
    rating: number,
    review: string
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Check if user is the student of this class
      if (learningClass.studentId.toString() !== studentId) {
        throw new Error('Bạn không có quyền đánh giá lớp học này');
      }

      // Validate rating
      if (rating < 1 || rating > 5) {
        throw new Error('Đánh giá phải từ 1 đến 5 sao');
      }

      const previousRating = learningClass.studentReview?.rating;

      // Add or update review
      learningClass.studentReview = {
        rating,
        comment: review,
        submittedAt: new Date(),
      };

      await learningClass.save();

      // Update tutor rating summary for search ranking
      const tutorId =
        typeof learningClass.tutorId === 'object' &&
        learningClass.tutorId !== null
          ? (learningClass.tutorId as any)._id?.toString() ||
            String(learningClass.tutorId)
          : String(learningClass.tutorId);

      await this.updateTutorRatingSummary(tutorId, rating, previousRating);

      return {
        success: true,
        message: 'Đánh giá lớp học thành công',
        data: learningClass,
      };
    } catch (error: any) {
      logger.error('Add student review error:', error);
      throw new Error(error.message || 'Không thể thêm đánh giá');
    }
  }

  /**
   * Add tutor feedback for class
   */
  async addTutorFeedback(
    classId: string,
    tutorId: string,
    rating: number,
    feedback: string
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Check if user is the tutor of this class
      if (learningClass.tutorId.toString() !== tutorId) {
        throw new Error('Bạn không có quyền đánh giá lớp học này');
      }

      // Add feedback
      learningClass.tutorReview = {
        rating,
        comment: feedback,
        submittedAt: new Date(),
      };

      await learningClass.save();

      return {
        success: true,
        message: 'Đánh giá học viên thành công',
        data: learningClass,
      };
    } catch (error: any) {
      logger.error('Add tutor feedback error:', error);
      throw new Error(error.message || 'Không thể thêm đánh giá');
    }
  }

  /**
   * Get class schedule with detailed sessions
   */
  async getClassSchedule(classId: string, userId: string) {
    try {
      // First, get the raw document to check if IDs exist
      const rawClass = await LearningClass.findById(classId).lean();

      if (!rawClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Get populated version
      const learningClass = await LearningClass.findById(classId)
        .populate('tutorId', 'full_name avatar_url email phone_number')
        .populate('studentId', 'full_name avatar_url email phone_number')
        .populate('subject', 'name');

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Check authorization
      // Use raw IDs from database if populate failed
      const rawTutorId = rawClass.tutorId?.toString() || null;
      const rawStudentId = rawClass.studentId?.toString() || null;

      // Extract tutorId - prefer populated, fallback to raw
      let tutorId: string | null = null;
      if (learningClass.tutorId) {
        if (
          typeof learningClass.tutorId === 'object' &&
          learningClass.tutorId !== null
        ) {
          tutorId =
            (learningClass.tutorId as any)._id?.toString() ||
            (learningClass.tutorId as any).id?.toString() ||
            null;
        } else {
          tutorId = String(learningClass.tutorId);
        }
      }

      // If populate failed, use raw ID
      if (!tutorId && rawTutorId) {
        tutorId = rawTutorId;
      }

      // Extract studentId - prefer populated, fallback to raw
      let studentId: string | null = null;
      if (learningClass.studentId) {
        if (
          typeof learningClass.studentId === 'object' &&
          learningClass.studentId !== null
        ) {
          studentId =
            (learningClass.studentId as any)._id?.toString() ||
            (learningClass.studentId as any).id?.toString() ||
            null;
        } else {
          studentId = String(learningClass.studentId);
        }
      }

      // If populate failed, use raw ID
      if (!studentId && rawStudentId) {
        studentId = rawStudentId;
      }

      // Check if IDs are valid
      if (!tutorId) {
        throw new Error('Lớp học không có thông tin gia sư');
      }
      if (!studentId) {
        throw new Error('Lớp học không có thông tin học viên');
      }

      if (tutorId !== userId && studentId !== userId) {
        throw new Error('Bạn không có quyền xem lịch học này');
      }

      // Format sessions with additional info
      const formattedSessions = learningClass.sessions.map((session) => {
        const plainSession = toPlainObject(session);
        return {
          ...plainSession,
          homework: summarizeSessionHomework(plainSession),
          isUpcoming: new Date(plainSession.scheduledDate) > new Date(),
          isPast: new Date(plainSession.scheduledDate) < new Date(),
          canEdit: tutorId === userId,
          // Payment information
          paymentStatus: plainSession.paymentStatus || 'UNPAID',
          paymentRequired: plainSession.paymentRequired !== false, // Default true if not specified
        };
      });

      const tutorName =
        typeof learningClass.tutorId === 'object' &&
        learningClass.tutorId !== null
          ? (learningClass.tutorId as any).full_name ||
            (learningClass.tutorId as any).email ||
            'Gia sư'
          : 'Gia sư';
      const studentName =
        typeof learningClass.studentId === 'object' &&
        learningClass.studentId !== null
          ? (learningClass.studentId as any).full_name ||
            (learningClass.studentId as any).email ||
            'Học viên'
          : 'Học viên';

      const persistentAssignments = (learningClass.assignments || []).map(
        (assignment) => {
          const plainAssignment =
            typeof (assignment as any).toObject === 'function'
              ? (assignment as any).toObject()
              : JSON.parse(JSON.stringify(assignment));
          return {
            ...plainAssignment,
            source: 'CLASS' as const,
          };
        }
      );

      const sessionAssignments = formattedSessions.flatMap((session) => {
        const assignments =
          (session.homework?.assignments as
            | ISessionHomeworkAssignment[]
            | undefined) || [];
        if (!assignments.length) return [];

        return assignments.map((assignment) => {
          const assignmentEntityId =
            assignment._id || (assignment as { id?: string }).id || null;
          const submission = assignment.submission;
          const grade = assignment.grade;
          const derivedSubmission = submission
            ? [
                {
                  _id: `SESSION-${session.sessionNumber}-${assignmentEntityId || uuidv4()}`,
                  studentId,
                  studentName,
                  note: submission.notes,
                  fileUrl: submission.fileUrl,
                  fileName: undefined,
                  fileSize: undefined,
                  mimeType: undefined,
                  submittedAt: submission.submittedAt,
                  updatedAt: submission.submittedAt,
                },
              ]
            : [];

          return {
            _id: assignmentEntityId || `SESSION-${session.sessionNumber}`,
            title: assignment.title,
            instructions: assignment.description,
            attachment: assignment.fileUrl
              ? {
                  fileUrl: assignment.fileUrl,
                }
              : undefined,
            dueDate: assignment.deadline,
            createdBy: {
              userId: tutorId,
              fullName: tutorName,
            },
            submissions: derivedSubmission,
            createdAt: assignment.assignedAt,
            updatedAt:
              grade?.gradedAt ||
              submission?.submittedAt ||
              assignment.assignedAt,
            source: 'SESSION' as const,
            sessionNumber: session.sessionNumber,
            readOnly: true,
          };
        });
      });

      const combinedAssignments = [
        ...sessionAssignments,
        ...persistentAssignments,
      ].sort((a, b) => {
        const aDate = new Date(
          a.updatedAt || a.createdAt || new Date(0)
        ).getTime();
        const bDate = new Date(
          b.updatedAt || b.createdAt || new Date(0)
        ).getTime();
        return bDate - aDate;
      });

      return {
        success: true,
        data: {
          class: learningClass,
          sessions: formattedSessions,
          stats: {
            total: learningClass.totalSessions,
            completed: learningClass.completedSessions,
            scheduled: formattedSessions.filter(
              (s: any) => s.status === 'SCHEDULED'
            ).length,
            cancelled: formattedSessions.filter(
              (s: any) => s.status === 'CANCELLED'
            ).length,
            missed: formattedSessions.filter((s: any) => s.status === 'MISSED')
              .length,
          },
          materials: learningClass.materials,
          assignments: combinedAssignments,
        },
      };
    } catch (error: any) {
      logger.error('Get class schedule error:', error);
      throw new Error(error.message || 'Không thể lấy lịch học');
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    classId: string,
    sessionNumber: number,
    status: 'COMPLETED' | 'CANCELLED' | 'MISSED',
    userId: string,
    notes?: string
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Only tutor can update session status
      if (learningClass.tutorId.toString() !== userId) {
        throw new Error('Chỉ gia sư mới có thể cập nhật trạng thái buổi học');
      }

      // Find session
      const sessionIndex = learningClass.sessions.findIndex(
        (s) => s.sessionNumber === sessionNumber
      );

      if (sessionIndex === -1) {
        throw new Error('Không tìm thấy buổi học');
      }

      const session = learningClass.sessions[sessionIndex];

      // Update session
      session.status = status;
      if (notes) {
        session.notes = notes;
      }

      if (status === 'COMPLETED') {
        session.actualStartTime =
          session.actualStartTime || session.scheduledDate;
        session.actualEndTime = new Date();

        // Recalculate completed sessions to avoid double-counting
        learningClass.completedSessions = learningClass.sessions.filter(
          (s) => s.status === 'COMPLETED'
        ).length;

        // Auto-complete class when all sessions have been completed
        if (
          learningClass.completedSessions === learningClass.totalSessions &&
          learningClass.status !== 'COMPLETED'
        ) {
          learningClass.status = 'COMPLETED';
          learningClass.actualEndDate = new Date();
        }
      }

      await learningClass.save();

      return {
        success: true,
        message: 'Cập nhật trạng thái buổi học thành công',
        data: learningClass,
      };
    } catch (error: any) {
      logger.error('Update session status error:', error);
      throw new Error(
        error.message || 'Không thể cập nhật trạng thái buổi học'
      );
    }
  }

  /**
   * Mark attendance for session
   */
  async markAttendance(
    classId: string,
    sessionNumber: number,
    userId: string,
    userRole: string
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Check authorization
      const isTutor = learningClass.tutorId.toString() === userId;
      const isStudent = learningClass.studentId.toString() === userId;

      if (!isTutor && !isStudent) {
        throw new Error('Bạn không có quyền điểm danh buổi học này');
      }

      // Find session
      const sessionIndex = learningClass.sessions.findIndex(
        (s) => s.sessionNumber === sessionNumber
      );

      if (sessionIndex === -1) {
        throw new Error('Không tìm thấy buổi học');
      }

      const session = learningClass.sessions[sessionIndex];
      const now = new Date();
      const scheduledDate = new Date(session.scheduledDate);
      const sessionEndTime = new Date(
        scheduledDate.getTime() + session.duration * 60000
      );

      // Check if attendance time is valid (15 mins before to session end)
      const canAttendTime = new Date(scheduledDate.getTime() - 15 * 60000);

      if (now < canAttendTime) {
        throw new Error(
          'Chưa đến giờ điểm danh. Bạn có thể điểm danh từ 15 phút trước giờ học.'
        );
      }

      if (now > sessionEndTime) {
        throw new Error('Đã quá giờ điểm danh');
      }

      // Initialize attendance if not exists
      if (!session.attendance) {
        session.attendance = {
          tutorAttended: false,
          studentAttended: false,
        };
      }

      // Mark attendance based on role
      if (isTutor) {
        if (session.attendance.tutorAttended) {
          throw new Error('Bạn đã điểm danh rồi');
        }
        session.attendance.tutorAttended = true;
        session.attendance.tutorAttendedAt = now;
      } else if (isStudent) {
        if (session.attendance.studentAttended) {
          throw new Error('Bạn đã điểm danh rồi');
        }
        session.attendance.studentAttended = true;
        session.attendance.studentAttendedAt = now;
      }

      // Check if both attended -> auto complete session
      const bothAttended =
        session.attendance.tutorAttended && session.attendance.studentAttended;

      if (bothAttended && session.status === 'SCHEDULED') {
        session.status = 'COMPLETED';
        session.actualStartTime = session.actualStartTime || now;
        session.actualEndTime = sessionEndTime;

        // Recalculate completed sessions to avoid double-counting
        learningClass.completedSessions = learningClass.sessions.filter(
          (s) => s.status === 'COMPLETED'
        ).length;

        // Auto-complete class when all sessions have been completed
        if (
          learningClass.completedSessions === learningClass.totalSessions &&
          learningClass.status !== 'COMPLETED'
        ) {
          learningClass.status = 'COMPLETED';
          learningClass.actualEndDate = new Date();
        }
      }

      await learningClass.save();

      return {
        success: true,
        message: 'Điểm danh thành công',
        data: {
          attendance: session.attendance,
          bothAttended,
          sessionStatus: session.status,
          canJoinMeeting: bothAttended,
        },
      };
    } catch (error: any) {
      logger.error('Mark attendance error:', error);
      throw new Error(error.message || 'Không thể điểm danh');
    }
  }

  /**
   * Assign homework (tutor only)
   */
  async assignHomework(
    classId: string,
    sessionNumber: number,
    userId: string,
    homeworkData: {
      title: string;
      description: string;
      fileUrl?: string;
      deadline: Date;
      templateId?: string;
    }
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Only tutor can assign homework
      if (learningClass.tutorId.toString() !== userId) {
        throw new Error('Chỉ gia sư mới có thể giao bài tập');
      }

      // Find session
      const sessionIndex = learningClass.sessions.findIndex(
        (s) => s.sessionNumber === sessionNumber
      );

      if (sessionIndex === -1) {
        throw new Error('Không tìm thấy buổi học');
      }

      const session = learningClass.sessions[sessionIndex];

      // Can only assign homework after session is completed
      if (session.status !== 'COMPLETED') {
        throw new Error('Chỉ có thể giao bài tập sau khi buổi học hoàn thành');
      }

      // Validate deadline
      if (new Date(homeworkData.deadline) <= new Date()) {
        throw new Error('Hạn nộp bài phải sau thời điểm hiện tại');
      }

      if (!session.homework) {
        session.homework = { assignments: [] } as any;
      }
      const sessionHomework = session.homework!;
      if (!sessionHomework.assignments) {
        sessionHomework.assignments = [];
      }

      const newAssignment: any = {
        _id: uuidv4(),
        title: homeworkData.title,
        description: homeworkData.description,
        fileUrl: homeworkData.fileUrl,
        deadline: new Date(homeworkData.deadline),
        assignedAt: new Date(),
      };

      if (homeworkData.templateId) {
        newAssignment.templateId = homeworkData.templateId;
      }

      sessionHomework.assignments.push(newAssignment);
      if (typeof (session as any).markModified === 'function') {
        (session as any).markModified('homework.assignments');
      }

      await learningClass.save();

      // Send notification to student
      try {
        const tutor = await User.findById(userId);
        const tutorName = tutor?.full_name || tutor?.email || 'Gia sư';
        const subject = await Subject.findById(learningClass.subject);
        const className = subject?.name || learningClass.title || 'Lớp học';

        await notifyHomeworkAssigned(
          learningClass.studentId.toString(),
          tutorName,
          className,
          homeworkData.title,
          homeworkData.deadline.toISOString(),
          learningClass._id.toString(),
          sessionNumber
        );
      } catch (notifError) {
        logger.error('Failed to send notification:', notifError);
        // Don't throw error, just log it
      }

      return {
        success: true,
        message: 'Giao bài tập thành công',
        data: {
          sessionNumber,
          homework: summarizeSessionHomework(toPlainObject(session)),
        },
      };
    } catch (error: any) {
      logger.error('Assign homework error:', error);
      throw new Error(error.message || 'Không thể giao bài tập');
    }
  }

  /**
   * Submit homework (student only)
   */
  async submitHomework(
    classId: string,
    sessionNumber: number,
    userId: string,
    submissionData: {
      assignmentId?: string;
      fileUrl: string;
      notes?: string;
      textAnswer?: string;
      audioUrl?: string;
    }
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Only student can submit homework
      if (learningClass.studentId.toString() !== userId) {
        throw new Error('Chỉ học viên mới có thể nộp bài tập');
      }

      // Find session
      const sessionIndex = learningClass.sessions.findIndex(
        (s) => s.sessionNumber === sessionNumber
      );

      if (sessionIndex === -1) {
        throw new Error('Không tìm thấy buổi học');
      }

      const session = learningClass.sessions[sessionIndex];

      const assignmentList = Array.isArray(session.homework?.assignments)
        ? session.homework!.assignments!
        : [];
      const legacyAssignment = session.homework?.assignment;

      if (!assignmentList.length && !legacyAssignment) {
        throw new Error('Chưa có bài tập được giao cho buổi học này');
      }

      if (!submissionData.assignmentId && assignmentList.length > 1) {
        throw new Error('Vui lòng chọn bài tập cụ thể để nộp');
      }

      const assignmentTarget = resolveSessionAssignment(
        session,
        submissionData.assignmentId
      );
      if (!assignmentTarget) {
        throw new Error('Không tìm thấy bài tập cần nộp');
      }

      const now = new Date();
      let deadline: Date | undefined;
      let assignmentTitle = '';
      let resolvedAssignmentId = submissionData.assignmentId;

      // Auto-transcribe audio to text if available
      let speakingTranscript: string | undefined;
      if (submissionData.audioUrl && speechToTextService.isAvailable()) {
        try {
          logger.info('Starting audio transcription for submission...');
          speakingTranscript = await speechToTextService.transcribeFromUrl(
            submissionData.audioUrl
          );
          logger.info(
            'Audio transcription completed:',
            speakingTranscript?.substring(0, 100)
          );
        } catch (transcribeError: any) {
          logger.warn(
            'Audio transcription failed (non-blocking):',
            transcribeError.message
          );
          // Don't block submission if transcription fails
        }
      }

      // Use transcript as textAnswer if no text provided but audio is transcribed
      const finalTextAnswer =
        submissionData.textAnswer?.trim() || speakingTranscript;

      if (assignmentTarget.mode === 'array') {
        const assignment = assignmentTarget.assignment;
        assignment.submission = {
          _id: uuidv4(),
          fileUrl: submissionData.fileUrl,
          notes: submissionData.notes,
          submittedAt: now,
          textAnswer: finalTextAnswer,
          audioUrl: submissionData.audioUrl,
          speakingTranscript,
        };
        deadline = assignment.deadline
          ? new Date(assignment.deadline)
          : undefined;
        assignmentTitle = assignment.title;
        resolvedAssignmentId =
          assignment._id?.toString() || assignment.id || resolvedAssignmentId;
      } else {
        if (!session.homework?.assignment) {
          throw new Error('Không tìm thấy thông tin bài tập legacy');
        }
        session.homework.submission = {
          fileUrl: submissionData.fileUrl,
          notes: submissionData.notes,
          submittedAt: now,
          textAnswer: finalTextAnswer,
          audioUrl: submissionData.audioUrl,
          speakingTranscript,
        };
        deadline = session.homework.assignment.deadline
          ? new Date(session.homework.assignment.deadline)
          : undefined;
        assignmentTitle = session.homework.assignment.title;
        resolvedAssignmentId =
          submissionData.assignmentId ||
          `${LEGACY_ASSIGNMENT_PREFIX}-${session.sessionNumber}`;
      }

      const isLate = deadline ? now > deadline : false;

      await learningClass.save();

      // Send notification to tutor
      try {
        const student = await User.findById(userId);
        const studentName = student?.full_name || student?.email || 'Học viên';
        const subject = await Subject.findById(learningClass.subject);
        const className = subject?.name || learningClass.title || 'Lớp học';

        await notifyHomeworkSubmitted(
          learningClass.tutorId.toString(),
          studentName,
          className,
          assignmentTitle,
          learningClass._id.toString(),
          sessionNumber
        );
      } catch (notifError) {
        logger.error('Failed to send notification:', notifError);
        // Don't throw error, just log it
      }

      return {
        success: true,
        message: isLate ? 'Nộp bài thành công (Trễ hạn)' : 'Nộp bài thành công',
        data: {
          sessionNumber,
          assignmentId: resolvedAssignmentId,
          submission:
            assignmentTarget.mode === 'array'
              ? assignmentTarget.assignment.submission
              : session.homework!.submission,
          isLate,
          deadline,
          homework: summarizeSessionHomework(toPlainObject(session)),
        },
      };
    } catch (error: any) {
      logger.error('Submit homework error:', error);
      throw new Error(error.message || 'Không thể nộp bài tập');
    }
  }

  /**
   * Get all student assignments
   */
  async getStudentAssignments(studentId: string) {
    try {
      const classes = await LearningClass.find({ studentId })
        .populate('tutorId', 'full_name avatar_url email')
        .populate('subject', 'name')
        .lean();

      const assignments: any[] = [];

      classes.forEach((learningClass) => {
        learningClass.sessions.forEach((session) => {
          const sessionAssignments = buildSessionAssignmentList(session);
          sessionAssignments.forEach((assignment) => {
            const now = new Date();
            const deadline = assignment.deadline
              ? new Date(assignment.deadline)
              : undefined;
            const submission = assignment.submission;
            const grade = assignment.grade;
            let status: 'pending' | 'submitted' | 'completed' = 'pending';
            if (grade) {
              status = 'completed';
            } else if (submission) {
              status = 'submitted';
            }
            const isLate =
              submission && deadline
                ? new Date(submission.submittedAt) > deadline
                : false;
            const isOverdue = !submission && deadline ? now > deadline : false;

            assignments.push({
              id:
                assignment.id ||
                `${learningClass._id}-${session.sessionNumber}`,
              assignmentId: assignment.id,
              classId: learningClass._id.toString(),
              className:
                (learningClass as any).subject?.name || learningClass.title,
              sessionNumber: session.sessionNumber,
              scheduledDate: session.scheduledDate,
              title: assignment.title,
              description: assignment.description,
              fileUrl: assignment.fileUrl,
              deadline: assignment.deadline,
              assignedAt: assignment.assignedAt,
              tutor: {
                id:
                  (learningClass as any).tutorId?._id?.toString() ||
                  learningClass.tutorId.toString(),
                name: (learningClass as any).tutorId?.full_name || 'Gia sư',
                avatar: (learningClass as any).tutorId?.avatar_url,
              },
              submission: submission || null,
              grade: grade || null,
              status,
              isLate,
              isOverdue,
              isLegacy: assignment.isLegacy || false,
            });
          });
        });
      });

      // Sort by deadline (upcoming first)
      assignments.sort((a, b) => {
        const dateA = a.deadline
          ? new Date(a.deadline).getTime()
          : Number.MAX_SAFE_INTEGER;
        const dateB = b.deadline
          ? new Date(b.deadline).getTime()
          : Number.MAX_SAFE_INTEGER;
        return dateA - dateB;
      });

      return {
        success: true,
        data: {
          assignments,
          total: assignments.length,
          pending: assignments.filter((a) => a.status === 'pending').length,
          submitted: assignments.filter((a) => a.status === 'submitted').length,
          completed: assignments.filter((a) => a.status === 'completed').length,
        },
      };
    } catch (error: any) {
      logger.error('Get student assignments error:', error);
      throw new Error('Không thể lấy danh sách bài tập');
    }
  }

  /**
   * Get all tutor assignments (from all classes)
   */
  async getTutorAssignments(tutorId: string) {
    try {
      const classes = await LearningClass.find({ tutorId })
        .populate('studentId', 'full_name avatar_url email')
        .populate('subject', 'name')
        .lean();

      const assignments: any[] = [];

      classes.forEach((learningClass) => {
        if (!learningClass.sessions || !Array.isArray(learningClass.sessions)) {
          return;
        }

        learningClass.sessions.forEach((session) => {
          try {
            const sessionAssignments = buildSessionAssignmentList(session);

            sessionAssignments.forEach((assignment) => {
              try {
                const submission = assignment.submission;
                const grade = assignment.grade;
                let status: 'pending_submission' | 'pending_grade' | 'graded' =
                  'pending_submission';
                if (grade) {
                  status = 'graded';
                } else if (submission) {
                  status = 'pending_grade';
                }

                const now = new Date();
                const deadline = assignment.deadline
                  ? new Date(assignment.deadline)
                  : undefined;
                const isLate =
                  submission && deadline
                    ? new Date(submission.submittedAt) > deadline
                    : false;
                const isOverdue =
                  !submission && deadline ? now > deadline : false;

                assignments.push({
                  id:
                    assignment.id ||
                    `${learningClass._id}-${session.sessionNumber}`,
                  assignmentId: assignment.id,
                  classId: learningClass._id.toString(),
                  className:
                    (learningClass as any).subject?.name || learningClass.title,
                  sessionNumber: session.sessionNumber,
                  scheduledDate: session.scheduledDate,
                  title: assignment.title,
                  description: assignment.description,
                  fileUrl: assignment.fileUrl,
                  deadline: assignment.deadline,
                  assignedAt: assignment.assignedAt,
                  student: {
                    id:
                      (learningClass as any).studentId?._id?.toString() ||
                      learningClass.studentId.toString(),
                    name:
                      (learningClass as any).studentId?.full_name || 'Học viên',
                    avatar: (learningClass as any).studentId?.avatar_url,
                  },
                  submission: submission || null,
                  grade: grade || null,
                  status,
                  isLate,
                  isOverdue,
                  isLegacy: assignment.isLegacy || false,
                });
              } catch (assignmentError: any) {
                logger.error(
                  'Error processing assignment:',
                  assignmentError.message
                );
              }
            });
          } catch (sessionError: any) {
            logger.error('Error processing session:', sessionError.message);
          }
        });
      });

      // Sort by deadline (upcoming first)
      assignments.sort((a, b) => {
        const dateA = a.deadline
          ? new Date(a.deadline).getTime()
          : Number.MAX_SAFE_INTEGER;
        const dateB = b.deadline
          ? new Date(b.deadline).getTime()
          : Number.MAX_SAFE_INTEGER;
        return dateA - dateB;
      });

      return {
        success: true,
        data: {
          assignments,
          total: assignments.length,
          pendingSubmission: assignments.filter(
            (a) => a.status === 'pending_submission'
          ).length,
          pendingGrade: assignments.filter((a) => a.status === 'pending_grade')
            .length,
          graded: assignments.filter((a) => a.status === 'graded').length,
        },
      };
    } catch (error: any) {
      logger.error('Error getting tutor assignments:', error.message);
      throw new Error('Không thể lấy danh sách bài tập');
    }
  }

  /**
   * Grade homework (tutor only)
   */
  async gradeHomework(
    classId: string,
    sessionNumber: number,
    userId: string,
    gradeData: {
      assignmentId?: string;
      score: number;
      feedback?: string;
    }
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Only tutor can grade homework
      if (learningClass.tutorId.toString() !== userId) {
        throw new Error('Chỉ gia sư mới có thể chấm điểm');
      }

      // Find session
      const sessionIndex = learningClass.sessions.findIndex(
        (s) => s.sessionNumber === sessionNumber
      );

      if (sessionIndex === -1) {
        throw new Error('Không tìm thấy buổi học');
      }

      const session = learningClass.sessions[sessionIndex];

      const assignmentList = Array.isArray(session.homework?.assignments)
        ? session.homework!.assignments!
        : [];
      const legacyAssignment = session.homework?.assignment;

      if (!assignmentList.length && !legacyAssignment) {
        throw new Error('Chưa có bài tập để chấm điểm');
      }

      if (!gradeData.assignmentId && assignmentList.length > 1) {
        throw new Error('Vui lòng chọn bài tập cụ thể để chấm điểm');
      }

      const assignmentTarget = resolveSessionAssignment(
        session,
        gradeData.assignmentId
      );
      if (!assignmentTarget) {
        throw new Error('Không tìm thấy bài tập cần chấm');
      }

      // Validate score
      if (gradeData.score < 0 || gradeData.score > 10) {
        throw new Error('Điểm phải từ 0 đến 10');
      }

      const now = new Date();
      let resolvedAssignmentId = gradeData.assignmentId;
      let assignmentTitle = '';

      if (assignmentTarget.mode === 'array') {
        const assignment = assignmentTarget.assignment;
        if (!assignment.submission) {
          throw new Error('Học viên chưa nộp bài tập này');
        }
        assignment.grade = {
          score: gradeData.score,
          feedback: gradeData.feedback,
          gradedAt: now,
        };
        assignmentTitle = assignment.title;
        resolvedAssignmentId =
          assignment._id?.toString() || assignment.id || resolvedAssignmentId;
      } else {
        if (!session.homework?.submission) {
          throw new Error('Học viên chưa nộp bài tập');
        }
        session.homework.grade = {
          score: gradeData.score,
          feedback: gradeData.feedback,
          gradedAt: now,
        };
        assignmentTitle = session.homework.assignment?.title || 'Bài tập';
        resolvedAssignmentId =
          gradeData.assignmentId ||
          `${LEGACY_ASSIGNMENT_PREFIX}-${session.sessionNumber}`;
      }

      await learningClass.save();

      // Send notification to student
      try {
        const tutor = await User.findById(userId);
        const tutorName = tutor?.full_name || tutor?.email || 'Gia sư';
        const subject = await Subject.findById(learningClass.subject);
        const className = subject?.name || learningClass.title || 'Lớp học';

        await notifyHomeworkGraded(
          learningClass.studentId.toString(),
          tutorName,
          className,
          gradeData.score,
          assignmentTitle,
          learningClass._id.toString(),
          sessionNumber
        );
      } catch (notifError) {
        logger.error('Failed to send notification:', notifError);
        // Don't throw error, just log it
      }

      return {
        success: true,
        message: 'Chấm điểm thành công',
        data: {
          sessionNumber,
          assignmentId: resolvedAssignmentId,
          grade:
            assignmentTarget.mode === 'array'
              ? assignmentTarget.assignment.grade
              : session.homework!.grade,
          homework: summarizeSessionHomework(toPlainObject(session)),
        },
      };
    } catch (error: any) {
      logger.error('Grade homework error:', error);
      throw new Error(error.message || 'Không thể chấm điểm');
    }
  }

  /**
   * Get weekly schedule
   */
  async getWeeklySchedule(userId: string, userRole: string, targetDate: Date) {
    try {
      // Get start and end of week
      const date = new Date(targetDate);
      const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Monday start

      const weekStart = new Date(date.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Find classes based on role
      const query =
        userRole === 'TUTOR' ? { tutorId: userId } : { studentId: userId };

      const classes = await LearningClass.find(query)
        .populate('tutorId', 'full_name avatar_url')
        .populate('studentId', 'full_name avatar_url')
        .populate('subject', 'name');

      // Collect all sessions in the week
      const weekSessions: any[] = [];

      for (const learningClass of classes) {
        for (const session of learningClass.sessions) {
          const sessionDate = new Date(session.scheduledDate);

          if (sessionDate >= weekStart && sessionDate <= weekEnd) {
            const now = new Date();
            const sessionEndTime = new Date(
              sessionDate.getTime() + session.duration * 60000
            );
            const canAttendTime = new Date(sessionDate.getTime() - 15 * 60000);

            const canAttend = now >= canAttendTime && now <= sessionEndTime;
            const bothAttended =
              session.attendance?.tutorAttended &&
              session.attendance?.studentAttended;
            const sessionPlain = toPlainObject(session);
            const homeworkSummary = summarizeSessionHomework(sessionPlain);

            weekSessions.push({
              classId: learningClass._id,
              className: learningClass.subject
                ? (learningClass.subject as any).name
                : 'N/A',
              sessionNumber: session.sessionNumber,
              scheduledDate: session.scheduledDate,
              dayOfWeek: sessionDate.getDay(),
              timeSlot: `${sessionDate.getHours()}:${String(sessionDate.getMinutes()).padStart(2, '0')} - ${sessionEndTime.getHours()}:${String(sessionEndTime.getMinutes()).padStart(2, '0')}`,
              duration: session.duration,
              status: session.status,
              learningMode: learningClass.learningMode,
              meetingLink: learningClass.onlineInfo?.meetingLink,
              location: learningClass.location
                ? {
                    details: (learningClass.location as any).address,
                  }
                : undefined,
              attendance: session.attendance || {
                tutorAttended: false,
                studentAttended: false,
              },
              homework: homeworkSummary,
              cancellationRequest: session.cancellationRequest || null,
              // Payment information
              paymentStatus: session.paymentStatus || 'UNPAID',
              paymentRequired: session.paymentRequired !== false, // Default true if not specified
              canAttend,
              canJoin: bothAttended,
              tutor: learningClass.tutorId,
              student: learningClass.studentId,
            });
          }
        }
      }

      // Sort by date
      weekSessions.sort(
        (a, b) =>
          new Date(a.scheduledDate).getTime() -
          new Date(b.scheduledDate).getTime()
      );

      return {
        success: true,
        data: {
          weekStart,
          weekEnd,
          sessions: weekSessions,
          totalSessions: weekSessions.length,
        },
      };
    } catch (error: any) {
      logger.error('Get weekly schedule error:', error);
      throw new Error(error.message || 'Không thể lấy lịch học tuần');
    }
  }

  /**
   * Request to cancel session (both tutor and student can request)
   */
  async requestCancelSession(
    classId: string,
    sessionNumber: number,
    userId: string,
    userRole: string,
    reason: string
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Verify user is part of this class
      const isTutor = learningClass.tutorId.toString() === userId;
      const isStudent = learningClass.studentId.toString() === userId;

      if (!isTutor && !isStudent) {
        throw new Error('Bạn không có quyền huỷ buổi học này');
      }

      // Find session
      const session = learningClass.sessions.find(
        (s) => s.sessionNumber === sessionNumber
      );
      if (!session) {
        throw new Error('Không tìm thấy buổi học');
      }

      // Check if session can be cancelled
      if (session.status === 'COMPLETED') {
        throw new Error('Không thể huỷ buổi học đã hoàn thành');
      }

      if (session.status === 'CANCELLED') {
        throw new Error('Buổi học đã được huỷ');
      }

      if (session.status === 'PENDING_CANCELLATION') {
        throw new Error('Đã có yêu cầu huỷ buổi học đang chờ phê duyệt');
      }

      if (!reason || reason.trim().length < 10) {
        throw new Error('Lý do huỷ phải có ít nhất 10 ký tự');
      }

      // Create cancellation request
      session.status = 'PENDING_CANCELLATION';
      session.cancellationRequest = {
        requestedBy: isTutor ? 'TUTOR' : 'STUDENT',
        reason: reason.trim(),
        requestedAt: new Date(),
        status: 'PENDING',
      };

      await learningClass.save();

      // Send notification to the other party
      try {
        const requester = await User.findById(userId);
        const requesterName =
          requester?.full_name ||
          requester?.email ||
          (isTutor ? 'Gia sư' : 'Học viên');
        const subject = await Subject.findById(learningClass.subject);
        const className = subject?.name || learningClass.title || 'Lớp học';
        const recipientId = isTutor
          ? learningClass.studentId.toString()
          : learningClass.tutorId.toString();

        await notifyCancellationRequested(
          recipientId,
          requesterName,
          className,
          sessionNumber,
          reason.trim(),
          learningClass._id.toString()
        );
      } catch (notifError) {
        logger.error('Failed to send notification:', notifError);
        // Don't throw error, just log it
      }

      return {
        success: true,
        message: 'Yêu cầu huỷ buổi học đã được gửi. Đang chờ phê duyệt.',
        data: {
          sessionNumber: session.sessionNumber,
          status: session.status,
          cancellationRequest: session.cancellationRequest,
        },
      };
    } catch (error: any) {
      logger.error('Request cancel session error:', error);
      throw new Error(error.message || 'Không thể gửi yêu cầu huỷ buổi học');
    }
  }

  /**
   * Respond to cancellation request (approve or reject)
   */
  async respondToCancellationRequest(
    classId: string,
    sessionNumber: number,
    userId: string,
    userRole: string,
    action: 'APPROVE' | 'REJECT'
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Verify user is part of this class
      const isTutor = learningClass.tutorId.toString() === userId;
      const isStudent = learningClass.studentId.toString() === userId;

      if (!isTutor && !isStudent) {
        throw new Error('Bạn không có quyền phản hồi yêu cầu này');
      }

      // Find session
      const session = learningClass.sessions.find(
        (s) => s.sessionNumber === sessionNumber
      );
      if (!session) {
        throw new Error('Không tìm thấy buổi học');
      }

      if (
        session.status !== 'PENDING_CANCELLATION' ||
        !session.cancellationRequest
      ) {
        throw new Error('Không có yêu cầu huỷ buổi học nào đang chờ phê duyệt');
      }

      // Check if user is the one who should respond
      const requestedByRole = session.cancellationRequest.requestedBy;
      const shouldBeRespondedBy =
        requestedByRole === 'TUTOR' ? 'STUDENT' : 'TUTOR';
      const currentUserRole = isTutor ? 'TUTOR' : 'STUDENT';

      if (currentUserRole !== shouldBeRespondedBy) {
        throw new Error('Bạn không thể phản hồi yêu cầu do chính mình tạo');
      }

      if (action === 'APPROVE') {
        // Approve cancellation
        session.status = 'CANCELLED';
        session.cancellationRequest.status = 'APPROVED';
        session.notes =
          (session.notes || '') +
          `\nLý do huỷ: ${session.cancellationRequest.reason}`;

        await learningClass.save();

        // Send notification to requester
        try {
          const responder = await User.findById(userId);
          const responderName =
            responder?.full_name ||
            responder?.email ||
            (isTutor ? 'Gia sư' : 'Học viên');
          const subject = await Subject.findById(learningClass.subject);
          const className = subject?.name || learningClass.title || 'Lớp học';
          const requesterId =
            session.cancellationRequest.requestedBy === 'TUTOR'
              ? learningClass.tutorId.toString()
              : learningClass.studentId.toString();

          await notifyCancellationResponded(
            requesterId,
            responderName,
            'APPROVED',
            className,
            sessionNumber,
            learningClass._id.toString()
          );
        } catch (notifError) {
          logger.error('Failed to send notification:', notifError);
        }

        return {
          success: true,
          message: 'Đã chấp nhận huỷ buổi học',
          data: {
            sessionNumber: session.sessionNumber,
            status: session.status,
          },
        };
      } else {
        // Reject cancellation
        session.status = 'SCHEDULED';
        session.cancellationRequest.status = 'REJECTED';

        await learningClass.save();

        // Send notification to requester
        try {
          const responder = await User.findById(userId);
          const responderName =
            responder?.full_name ||
            responder?.email ||
            (isTutor ? 'Gia sư' : 'Học viên');
          const subject = await Subject.findById(learningClass.subject);
          const className = subject?.name || learningClass.title || 'Lớp học';
          const requesterId =
            session.cancellationRequest.requestedBy === 'TUTOR'
              ? learningClass.tutorId.toString()
              : learningClass.studentId.toString();

          await notifyCancellationResponded(
            requesterId,
            responderName,
            'REJECTED',
            className,
            sessionNumber,
            learningClass._id.toString()
          );
        } catch (notifError) {
          logger.error('Failed to send notification:', notifError);
        }

        return {
          success: true,
          message: 'Đã từ chối yêu cầu huỷ buổi học',
          data: {
            sessionNumber: session.sessionNumber,
            status: session.status,
          },
        };
      }
    } catch (error: any) {
      logger.error('Respond to cancellation request error:', error);
      throw new Error(
        error.message || 'Không thể phản hồi yêu cầu huỷ buổi học'
      );
    }
  }

  /**
   * Class study materials
   */
  async getClassMaterials(classId: string, userId: string) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      const tutorId = learningClass.tutorId.toString();
      const studentId = learningClass.studentId.toString();
      if (userId !== tutorId && userId !== studentId) {
        throw new Error('Bạn không có quyền xem tài liệu lớp học này');
      }

      return {
        success: true,
        data: learningClass.materials,
      };
    } catch (error: any) {
      logger.error('Get class materials error:', error);
      throw new Error(error.message || 'Không thể tải danh sách tài liệu');
    }
  }

  async addClassMaterial(
    classId: string,
    tutorId: string,
    payload: {
      title: string;
      description?: string;
      fileUrl: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      visibility?: 'STUDENTS' | 'PRIVATE';
    }
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      if (learningClass.tutorId.toString() !== tutorId) {
        throw new Error('Chỉ gia sư mới có thể quản lý tài liệu lớp học');
      }

      const tutor = await User.findById(tutorId);

      learningClass.materials.push({
        title: payload.title,
        description: payload.description,
        fileUrl: payload.fileUrl,
        fileName: payload.fileName,
        fileSize: payload.fileSize,
        mimeType: payload.mimeType,
        visibility: payload.visibility || 'STUDENTS',
        uploadedBy: {
          userId: tutorId,
          role: 'TUTOR',
          fullName: tutor?.full_name || tutor?.email || 'Gia sư',
        },
      } as any);

      learningClass.markModified('materials');
      await learningClass.save();

      return {
        success: true,
        message: 'Thêm tài liệu thành công',
        data: learningClass.materials,
      };
    } catch (error: any) {
      logger.error('Add class material error:', error);
      throw new Error(error.message || 'Không thể thêm tài liệu');
    }
  }

  async updateClassMaterial(
    classId: string,
    materialId: string,
    tutorId: string,
    payload: {
      title?: string;
      description?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      visibility?: 'STUDENTS' | 'PRIVATE';
    }
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      if (learningClass.tutorId.toString() !== tutorId) {
        throw new Error('Chỉ gia sư mới có thể chỉnh sửa tài liệu');
      }

      const material = (learningClass.materials as any).id(materialId);
      if (!material) {
        throw new Error('Không tìm thấy tài liệu');
      }

      if (payload.title !== undefined) material.title = payload.title;
      if (payload.description !== undefined)
        material.description = payload.description;
      if (payload.fileUrl !== undefined) material.fileUrl = payload.fileUrl;
      if (payload.fileName !== undefined) material.fileName = payload.fileName;
      if (payload.fileSize !== undefined) material.fileSize = payload.fileSize;
      if (payload.mimeType !== undefined) material.mimeType = payload.mimeType;
      if (payload.visibility !== undefined)
        material.visibility = payload.visibility;

      material.set('updatedAt', new Date());

      learningClass.markModified('materials');
      await learningClass.save();

      return {
        success: true,
        message: 'Cập nhật tài liệu thành công',
        data: learningClass.materials,
      };
    } catch (error: any) {
      logger.error('Update class material error:', error);
      throw new Error(error.message || 'Không thể cập nhật tài liệu');
    }
  }

  async deleteClassMaterial(
    classId: string,
    materialId: string,
    tutorId: string
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      if (learningClass.tutorId.toString() !== tutorId) {
        throw new Error('Chỉ gia sư mới có thể xoá tài liệu');
      }

      // Check if material exists and filter it out
      const initialCount = learningClass.materials?.length || 0;
      learningClass.materials = (learningClass.materials || []).filter(
        (m: any) =>
          m._id?.toString() !== materialId && m.id?.toString() !== materialId
      );

      if (learningClass.materials.length === initialCount) {
        throw new Error('Không tìm thấy tài liệu');
      }

      learningClass.markModified('materials');
      await learningClass.save();

      return {
        success: true,
        message: 'Đã xoá tài liệu',
        data: learningClass.materials,
      };
    } catch (error: any) {
      logger.error('Delete class material error:', error);
      throw new Error(error.message || 'Không thể xoá tài liệu');
    }
  }

  /**
   * Class-level assignments
   */
  async getClassAssignments(classId: string, userId: string) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      const tutorId = learningClass.tutorId.toString();
      const studentId = learningClass.studentId.toString();
      if (userId !== tutorId && userId !== studentId) {
        throw new Error('Bạn không có quyền xem danh sách bài tập');
      }

      return {
        success: true,
        data: learningClass.assignments,
      };
    } catch (error: any) {
      logger.error('Get class assignments error:', error);
      throw new Error(error.message || 'Không thể tải danh sách bài tập');
    }
  }

  async createClassAssignment(
    classId: string,
    tutorId: string,
    payload: {
      title: string;
      instructions?: string;
      dueDate?: string;
      attachment?: {
        fileUrl: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
      };
    }
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      if (learningClass.tutorId.toString() !== tutorId) {
        throw new Error('Chỉ gia sư mới có thể tạo bài tập');
      }

      const tutor = await User.findById(tutorId);

      learningClass.assignments.push({
        title: payload.title,
        instructions: payload.instructions,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
        attachment: payload.attachment,
        createdBy: {
          userId: tutorId,
          fullName: tutor?.full_name || tutor?.email || 'Gia sư',
        },
        submissions: [],
      } as any);

      learningClass.markModified('assignments');
      await learningClass.save();

      return {
        success: true,
        message: 'Tạo bài tập thành công',
        data: learningClass.assignments,
      };
    } catch (error: any) {
      logger.error('Create class assignment error:', error);
      throw new Error(error.message || 'Không thể tạo bài tập');
    }
  }

  async updateClassAssignment(
    classId: string,
    assignmentId: string,
    tutorId: string,
    payload: {
      title?: string;
      instructions?: string;
      dueDate?: string;
      attachment?: {
        fileUrl: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
      } | null;
    }
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      if (learningClass.tutorId.toString() !== tutorId) {
        throw new Error('Chỉ gia sư mới có thể chỉnh sửa bài tập');
      }

      const assignment = (learningClass.assignments as any).id(assignmentId);
      if (!assignment) {
        throw new Error('Không tìm thấy bài tập');
      }

      if (payload.title !== undefined) assignment.title = payload.title;
      if (payload.instructions !== undefined)
        assignment.instructions = payload.instructions;
      if (payload.dueDate !== undefined) {
        assignment.dueDate = payload.dueDate
          ? new Date(payload.dueDate)
          : undefined;
      }
      if (payload.attachment !== undefined) {
        assignment.attachment =
          payload.attachment === null ? undefined : payload.attachment;
      }

      assignment.set('updatedAt', new Date());
      learningClass.markModified('assignments');
      await learningClass.save();

      return {
        success: true,
        message: 'Cập nhật bài tập thành công',
        data: learningClass.assignments,
      };
    } catch (error: any) {
      logger.error('Update class assignment error:', error);
      throw new Error(error.message || 'Không thể cập nhật bài tập');
    }
  }

  async deleteClassAssignment(
    classId: string,
    assignmentId: string,
    tutorId: string
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      if (learningClass.tutorId.toString() !== tutorId) {
        throw new Error('Chỉ gia sư mới có thể xoá bài tập');
      }

      const assignment = (learningClass.assignments as any).id(assignmentId);
      if (!assignment) {
        throw new Error('Không tìm thấy bài tập');
      }

      assignment.remove();
      learningClass.markModified('assignments');
      await learningClass.save();

      return {
        success: true,
        message: 'Đã xoá bài tập',
        data: learningClass.assignments,
      };
    } catch (error: any) {
      logger.error('Delete class assignment error:', error);
      throw new Error(error.message || 'Không thể xoá bài tập');
    }
  }

  async submitAssignmentWork(
    classId: string,
    assignmentId: string,
    studentId: string,
    payload: {
      note?: string;
      fileUrl: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    }
  ) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      if (learningClass.studentId.toString() !== studentId) {
        throw new Error('Chỉ học viên của lớp mới có thể nộp bài');
      }

      const assignment = (learningClass.assignments as any).id(assignmentId);
      if (!assignment) {
        throw new Error('Không tìm thấy bài tập');
      }

      const student = await User.findById(studentId);
      const studentName = student?.full_name || student?.email || 'Học viên';

      const existingSubmission = assignment.submissions.find(
        (sub: any) => sub.studentId === studentId
      );

      if (existingSubmission) {
        existingSubmission.note = payload.note;
        existingSubmission.fileUrl = payload.fileUrl;
        existingSubmission.fileName = payload.fileName;
        existingSubmission.fileSize = payload.fileSize;
        existingSubmission.mimeType = payload.mimeType;
        existingSubmission.set('updatedAt', new Date());
      } else {
        assignment.submissions.push({
          studentId,
          studentName,
          note: payload.note,
          fileUrl: payload.fileUrl,
          fileName: payload.fileName,
          fileSize: payload.fileSize,
          mimeType: payload.mimeType,
        } as any);
      }

      learningClass.markModified('assignments');
      await learningClass.save();

      return {
        success: true,
        message: existingSubmission
          ? 'Đã cập nhật bài nộp'
          : 'Nộp bài thành công',
        data: learningClass.assignments,
      };
    } catch (error: any) {
      logger.error('Submit assignment work error:', error);
      throw new Error(error.message || 'Không thể nộp bài');
    }
  }

  /**
   * Get paginated public reviews for a tutor aggregated from completed classes
   */
  async getTutorReviews(tutorId: string, page = 1, limit = 10) {
    try {
      if (!tutorId) {
        throw new Error('Thiếu thông tin gia sư');
      }

      const normalizedPage = Math.max(1, Number(page) || 1);
      const normalizedLimit = Math.min(20, Math.max(1, Number(limit) || 10));
      const skip = (normalizedPage - 1) * normalizedLimit;

      const baseQuery = {
        tutorId,
        'studentReview.rating': { $exists: true },
      };

      const [classes, totalItems, tutorProfile] = await Promise.all([
        LearningClass.find(baseQuery)
          .select(
            'title subject studentId studentReview learningMode totalSessions completedSessions'
          )
          .populate('studentId', 'full_name avatar_url')
          .populate('subject', 'name')
          .sort({ 'studentReview.submittedAt': -1 })
          .skip(skip)
          .limit(normalizedLimit)
          .lean(),
        LearningClass.countDocuments(baseQuery),
        TutorProfile.findOne({ user_id: tutorId })
          .select('ratingAverage ratingCount badges lastReviewAt')
          .lean(),
      ]);

      const reviews = classes
        .filter((cls) => cls.studentReview)
        .map((cls) => {
          const student = cls.studentId as any;
          const subject = cls.subject as any;
          const review = cls.studentReview as any;

          return {
            classId: cls._id?.toString(),
            classTitle: cls.title,
            subjectName: subject?.name || undefined,
            learningMode: cls.learningMode,
            totalSessions: cls.totalSessions,
            completedSessions: cls.completedSessions,
            rating: review.rating,
            comment: review.comment || '',
            submittedAt: review.submittedAt,
            student: {
              id: student?._id?.toString() || student?.id || '',
              name: student?.full_name || 'Học viên ẩn danh',
              avatar: student?.avatar_url || null,
            },
          };
        });

      const pagination = {
        page: normalizedPage,
        limit: normalizedLimit,
        totalItems,
        totalPages: Math.ceil(totalItems / normalizedLimit) || 0,
        hasNext: normalizedPage * normalizedLimit < totalItems,
        hasPrev: normalizedPage > 1,
      };

      return {
        success: true,
        data: {
          summary: {
            tutorId,
            averageRating: tutorProfile?.ratingAverage || 0,
            totalReviews: tutorProfile?.ratingCount || totalItems || 0,
            badges: tutorProfile?.badges || [],
            lastReviewAt: tutorProfile?.lastReviewAt || null,
          },
          reviews,
          pagination,
        },
      };
    } catch (error: any) {
      logger.error('Get tutor reviews error:', error);
      throw new Error(error.message || 'Không thể tải danh sách đánh giá');
    }
  }

  /**
   * Update aggregated rating info for tutor profile when new review is submitted
   */
  private async updateTutorRatingSummary(
    tutorId: string,
    newRating: number,
    previousRating?: number
  ) {
    try {
      const tutorProfile = await TutorProfile.findOne({ user_id: tutorId });
      if (!tutorProfile) {
        return;
      }

      const currentCount = tutorProfile.ratingCount || 0;
      const currentSum = tutorProfile.ratingSum || 0;

      if (previousRating) {
        tutorProfile.ratingSum = Math.max(
          0,
          currentSum - previousRating + newRating
        );
      } else {
        tutorProfile.ratingCount = currentCount + 1;
        tutorProfile.ratingSum = currentSum + newRating;
      }

      const safeCount = tutorProfile.ratingCount || 0;
      tutorProfile.ratingAverage =
        safeCount > 0
          ? parseFloat((tutorProfile.ratingSum / safeCount).toFixed(2))
          : 0;
      tutorProfile.lastReviewAt = new Date();
      tutorProfile.badges = this.buildRatingBadges(tutorProfile);

      await tutorProfile.save();
    } catch (error) {
      logger.error('Update tutor rating summary error:', error);
    }
  }

  /**
   * Simple badge builder based on rating rules
   */
  private buildRatingBadges(profile: {
    badges?: string[];
    ratingAverage?: number;
    ratingCount?: number;
  }): string[] {
    const badges = new Set(profile.badges || []);
    badges.delete('TOP_RATED');
    badges.delete('HIGHLY_RATED');

    const avg = profile.ratingAverage || 0;
    const count = profile.ratingCount || 0;

    if (avg >= 4.8 && count >= 10) {
      badges.add('TOP_RATED');
    } else if (avg >= 4.5 && count >= 5) {
      badges.add('HIGHLY_RATED');
    }

    return Array.from(badges);
  }

  /**
   * Create learning class from contract after both parties sign
   */
  async createLearningClassFromContract(contract: any) {
    try {
      logger.info(`Creating learning class from contract: ${contract._id}`);

      // Populate contract data if not already populated
      if (typeof contract.studentId === 'string') {
        await contract.populate(
          'studentId tutorId tutorPostId subject contactRequestId'
        );
      }

      // Get subject from contract, tutorPost, or contactRequest
      let subject = contract.subject;

      if (!subject) {
        // Try to get from contactRequest
        const contactRequest = await import('../../models').then(
          (m) => m.ContactRequest
        );
        const request = await contactRequest.findById(
          contract.contactRequestId
        );
        if (request?.subject) {
          subject = request.subject;
        }
      }

      if (!subject) {
        // Try to get from tutorPost
        const tutorPost = await import('../../models').then((m) => m.TutorPost);
        const post = await tutorPost.findById(contract.tutorPostId);
        if (post?.subjects && post.subjects.length > 0) {
          subject = post.subjects[0]; // Take first subject
        }
      }

      if (!subject) {
        throw new Error(
          'Cannot create learning class: Subject is required but not found in contract, contact request, or tutor post'
        );
      }

      // Extract _id if subject is an object (populated)
      const subjectId =
        typeof subject === 'object' && subject !== null
          ? (subject as any)._id?.toString() || (subject as any).id?.toString()
          : subject.toString();

      // Determine effective learning mode (reuse contract mode directly)
      const determinedLearningMode = contract.learningMode;

      // Auto-provision online meeting if needed (similar logic to contactRequest service)
      let finalOnlineInfo = contract.onlineInfo;
      if (determinedLearningMode === 'ONLINE') {
        const missingMeetingLink = !finalOnlineInfo?.meetingLink;
        if (missingMeetingLink) {
          try {
            const { provisionOnlineMeeting } = await import(
              '../meeting/meeting.service'
            );
            const provisioned = await provisionOnlineMeeting(
              finalOnlineInfo?.platform || 'OTHER',
              {
                title: contract.classTitle || contract.title,
                startDate: contract.startDate,
                schedule: contract.schedule,
              }
            );
            if (provisioned) {
              finalOnlineInfo = provisioned;
            }
          } catch (provisionErr) {
            logger.warn(
              'Online meeting provisioning failed when creating class from contract. Proceeding without auto meeting.',
              provisionErr
            );
          }

          // Fallback: ensure a shared online room link even if provisioning fails
          if (!finalOnlineInfo || !finalOnlineInfo.meetingLink) {
            finalOnlineInfo = {
              platform: 'OTHER',
              meetingLink: `https://8x8.vc/${
                process.env.JITSI_TENANT || 'skillbridge'
              }/skillbridge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            } as any;
          }
        }
      }

      // Create learning class
      const learningClass = new LearningClass({
        contactRequestId: contract.contactRequestId,
        studentId: contract.studentId,
        tutorId: contract.tutorId,
        tutorPostId: contract.tutorPostId,
        subject: subjectId, // Use extracted ID

        title: contract.classTitle || contract.title,
        description: contract.classDescription || contract.description,
        pricePerSession: contract.pricePerSession,
        sessionDuration: contract.sessionDuration,
        totalSessions: contract.totalSessions,
        learningMode: determinedLearningMode,

        schedule: contract.schedule,
        startDate: contract.startDate,
        expectedEndDate: contract.expectedEndDate,
        location: contract.location,
        onlineInfo: finalOnlineInfo,

        sessions: [], // Will be generated
        totalAmount: contract.totalAmount,
      });

      await learningClass.save();

      // Generate sessions based on schedule
      await this.generateLearningSessions(learningClass._id);

      logger.info(`Learning class created successfully: ${learningClass._id}`);

      // Send notification to student
      try {
        const tutor = await User.findById(contract.tutorId);
        const tutorName = tutor?.full_name || tutor?.email || 'Gia sư';
        const { notifyClassCreated } = await import(
          '../notification/notification.helpers'
        );
        await notifyClassCreated(
          contract.studentId.toString(),
          tutorName,
          learningClass.title,
          learningClass._id.toString()
        );
      } catch (notifError) {
        logger.error('Failed to send notification:', notifError);
      }

      return learningClass;
    } catch (error: any) {
      logger.error('Error creating learning class from contract:', error);
      throw error;
    }
  }

  /**
   * Generate learning sessions based on schedule
   */
  private async generateLearningSessions(classId: string) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) return;

      const sessions = [];
      let sessionNumber = 1;
      let currentDate = new Date(learningClass.startDate);

      // Parse startTime from schedule (format: "HH:mm")
      const [startHour, startMinute] = learningClass.schedule.startTime
        .split(':')
        .map(Number);

      while (sessionNumber <= learningClass.totalSessions) {
        const dayOfWeek = currentDate.getDay();

        if (learningClass.schedule.dayOfWeek.includes(dayOfWeek)) {
          // Create scheduledDate with correct time
          const scheduledDateTime = new Date(currentDate);
          scheduledDateTime.setHours(startHour, startMinute, 0, 0);

          sessions.push({
            sessionNumber,
            scheduledDate: scheduledDateTime,
            duration: learningClass.sessionDuration,
            status: 'SCHEDULED' as const,
            paymentStatus: 'UNPAID' as const,
            paymentRequired: true,
            attendance: {
              tutorAttended: false,
              studentAttended: false,
            },
          });
          sessionNumber++;
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);

        // Safety check to prevent infinite loop
        if (currentDate.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000) {
          break;
        }
      }

      learningClass.sessions = sessions;
      await learningClass.save();
    } catch (error) {
      logger.error('Generate learning sessions error:', error);
    }
  }

  /**
   * Cancel learning class (used when contract is cancelled)
   */
  async cancelLearningClass(classId: string, userId: string, reason?: string) {
    try {
      const learningClass = await LearningClass.findById(classId);

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Verify user has permission
      if (
        learningClass.tutorId.toString() !== userId &&
        learningClass.studentId.toString() !== userId
      ) {
        throw new Error('Bạn không có quyền hủy lớp học này');
      }

      learningClass.status = 'CANCELLED';
      if (reason) {
        // Add cancellation reason to class notes if needed
        learningClass.actualEndDate = new Date();
      }

      await learningClass.save();

      logger.info(`Learning class ${classId} cancelled by user: ${userId}`);

      return learningClass;
    } catch (error: any) {
      logger.error('Cancel learning class error:', error);
      throw new Error(error.message || 'Không thể hủy lớp học');
    }
  }
}

export const classService = new ClassService();
