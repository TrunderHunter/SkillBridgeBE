import { LearningClass } from '../../models/LearningClass';
import { User } from '../../models/User';
import { Subject } from '../../models/Subject';
import { logger } from '../../utils/logger';
import { buildJitsiModeratorUrl } from '../meeting/meeting.service';
import {
  notifyHomeworkAssigned,
  notifyHomeworkSubmitted,
  notifyHomeworkGraded,
  notifyCancellationRequested,
  notifyCancellationResponded,
} from '../notification/notification.helpers';

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
        data: classes
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
        data: classes
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
      console.log('classId:', classId);
      const learningClass = await LearningClass.findById(classId)
        .populate('tutorId', 'full_name avatar_url email phone_number')
        .populate('studentId', 'full_name avatar_url email phone_number')
        .populate('subject', 'name')
        .populate('contactRequestId');

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Check if user is authorized to view this class
      // Fix: Extract IDs properly from populated objects
      const tutorId = typeof learningClass.tutorId === 'object' ?
        (learningClass.tutorId as any)._id.toString() :
        learningClass.tutorId.toString();

      const studentId = typeof learningClass.studentId === 'object' ?
        (learningClass.studentId as any)._id.toString() :
        learningClass.studentId.toString();

      console.log('Comparing IDs:', {
        userId,
        tutorId,
        studentId
      });

      if (tutorId !== userId && studentId !== userId) {
        throw new Error('Bạn không có quyền xem thông tin lớp học này');
      }

      return {
        success: true,
        data: learningClass
      };
    } catch (error: any) {
      logger.error('Get class details error:', error);
      throw new Error(error.message || 'Không thể lấy thông tin lớp học');
    }
  }

  /**
   * Get moderator join link for online class (tutor only)
   */
  async getModeratorJoinLink(classId: string, tutorId: string, opts?: { displayName?: string; email?: string }) {
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
      if (!['ACTIVE', 'COMPLETED', 'CANCELLED', 'PAUSED'].includes(status)) {
        throw new Error('Trạng thái không hợp lệ');
      }

      // Update status
      learningClass.status = status as 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'PAUSED';

      // If completed, set actual end date
      if (status === 'COMPLETED') {
        learningClass.actualEndDate = new Date();
      }

      await learningClass.save();

      return {
        success: true,
        message: 'Cập nhật trạng thái lớp học thành công',
        data: learningClass
      };
    } catch (error: any) {
      logger.error('Update class status error:', error);
      throw new Error(error.message || 'Không thể cập nhật trạng thái lớp học');
    }
  }

  /**
   * Add student review for class
   */
  async addStudentReview(classId: string, studentId: string, rating: number, review: string) {
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

      // Add review
      learningClass.studentReview = {
        rating,
        comment: review,
        submittedAt: new Date()
      };

      await learningClass.save();

      return {
        success: true,
        message: 'Đánh giá lớp học thành công',
        data: learningClass
      };
    } catch (error: any) {
      logger.error('Add student review error:', error);
      throw new Error(error.message || 'Không thể thêm đánh giá');
    }
  }

  /**
   * Add tutor feedback for class
   */
  async addTutorFeedback(classId: string, tutorId: string, rating: number, feedback: string) {
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
        submittedAt: new Date()
      };

      await learningClass.save();

      return {
        success: true,
        message: 'Đánh giá học viên thành công',
        data: learningClass
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
      const learningClass = await LearningClass.findById(classId)
        .populate('tutorId', 'full_name avatar_url email phone_number')
        .populate('studentId', 'full_name avatar_url email phone_number')
        .populate('subject', 'name');

      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Check authorization
      const tutorId = typeof learningClass.tutorId === 'object' ?
        (learningClass.tutorId as any)._id.toString() :
        learningClass.tutorId.toString();

      const studentId = typeof learningClass.studentId === 'object' ?
        (learningClass.studentId as any)._id.toString() :
        learningClass.studentId.toString();

      if (tutorId !== userId && studentId !== userId) {
        throw new Error('Bạn không có quyền xem lịch học này');
      }

      // Format sessions with additional info
      const formattedSessions = learningClass.sessions.map(session => ({
        ...(session as any).toObject ? (session as any).toObject() : JSON.parse(JSON.stringify(session)),
        isUpcoming: new Date(session.scheduledDate) > new Date(),
        isPast: new Date(session.scheduledDate) < new Date(),
        canEdit: tutorId === userId, // Only tutor can edit
      }));

      return {
        success: true,
        data: {
          class: learningClass,
          sessions: formattedSessions,
          stats: {
            total: learningClass.totalSessions,
            completed: learningClass.completedSessions,
            scheduled: formattedSessions.filter((s: any) => s.status === 'SCHEDULED').length,
            cancelled: formattedSessions.filter((s: any) => s.status === 'CANCELLED').length,
            missed: formattedSessions.filter((s: any) => s.status === 'MISSED').length,
          }
        }
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
        s => s.sessionNumber === sessionNumber
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
        session.actualStartTime = session.actualStartTime || session.scheduledDate;
        session.actualEndTime = new Date();
        learningClass.completedSessions += 1;
      }

      await learningClass.save();

      return {
        success: true,
        message: 'Cập nhật trạng thái buổi học thành công',
        data: learningClass
      };
    } catch (error: any) {
      logger.error('Update session status error:', error);
      throw new Error(error.message || 'Không thể cập nhật trạng thái buổi học');
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
        s => s.sessionNumber === sessionNumber
      );

      if (sessionIndex === -1) {
        throw new Error('Không tìm thấy buổi học');
      }

      const session = learningClass.sessions[sessionIndex];
      const now = new Date();
      const scheduledDate = new Date(session.scheduledDate);
      const sessionEndTime = new Date(scheduledDate.getTime() + session.duration * 60000);

      // Check if attendance time is valid (15 mins before to session end)
      const canAttendTime = new Date(scheduledDate.getTime() - 15 * 60000);

      if (now < canAttendTime) {
        throw new Error('Chưa đến giờ điểm danh. Bạn có thể điểm danh từ 15 phút trước giờ học.');
      }

      if (now > sessionEndTime) {
        throw new Error('Đã quá giờ điểm danh');
      }

      // Initialize attendance if not exists
      if (!session.attendance) {
        session.attendance = {
          tutorAttended: false,
          studentAttended: false
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
      const bothAttended = session.attendance.tutorAttended && session.attendance.studentAttended;

      if (bothAttended && session.status === 'SCHEDULED') {
        session.status = 'COMPLETED';
        session.actualStartTime = session.actualStartTime || now;
        session.actualEndTime = sessionEndTime;
        learningClass.completedSessions += 1;
      }

      await learningClass.save();

      return {
        success: true,
        message: 'Điểm danh thành công',
        data: {
          attendance: session.attendance,
          bothAttended,
          sessionStatus: session.status,
          canJoinMeeting: bothAttended
        }
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
        s => s.sessionNumber === sessionNumber
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

      // Initialize homework if not exists
      if (!session.homework) {
        session.homework = {};
      }

      // Assign homework
      session.homework.assignment = {
        title: homeworkData.title,
        description: homeworkData.description,
        fileUrl: homeworkData.fileUrl,
        deadline: new Date(homeworkData.deadline),
        assignedAt: new Date()
      };

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
          homework: session.homework
        }
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
      fileUrl: string;
      notes?: string;
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
        s => s.sessionNumber === sessionNumber
      );

      if (sessionIndex === -1) {
        throw new Error('Không tìm thấy buổi học');
      }

      const session = learningClass.sessions[sessionIndex];

      // Check if homework assignment exists
      if (!session.homework || !session.homework.assignment) {
        throw new Error('Chưa có bài tập được giao cho buổi học này');
      }

      // Check deadline
      const now = new Date();
      const deadline = new Date(session.homework.assignment.deadline);
      const isLate = now > deadline;

      // Submit homework
      session.homework.submission = {
        fileUrl: submissionData.fileUrl,
        notes: submissionData.notes,
        submittedAt: now
      };

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
          submission: session.homework.submission,
          isLate,
          deadline: session.homework.assignment.deadline
        }
      };
    } catch (error: any) {
      logger.error('Submit homework error:', error);
      throw new Error(error.message || 'Không thể nộp bài tập');
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
        s => s.sessionNumber === sessionNumber
      );

      if (sessionIndex === -1) {
        throw new Error('Không tìm thấy buổi học');
      }

      const session = learningClass.sessions[sessionIndex];

      // Check if homework submission exists
      if (!session.homework || !session.homework.submission) {
        throw new Error('Học viên chưa nộp bài tập');
      }

      // Validate score
      if (gradeData.score < 0 || gradeData.score > 10) {
        throw new Error('Điểm phải từ 0 đến 10');
      }

      // Grade homework
      session.homework.grade = {
        score: gradeData.score,
        feedback: gradeData.feedback,
        gradedAt: new Date()
      };

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
          grade: session.homework.grade
        }
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
      const query = userRole === 'TUTOR'
        ? { tutorId: userId }
        : { studentId: userId };

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
            const sessionEndTime = new Date(sessionDate.getTime() + session.duration * 60000);
            const canAttendTime = new Date(sessionDate.getTime() - 15 * 60000);

            const canAttend = now >= canAttendTime && now <= sessionEndTime;
            const bothAttended = session.attendance?.tutorAttended && session.attendance?.studentAttended;

            weekSessions.push({
              classId: learningClass._id,
              className: learningClass.subject ? (learningClass.subject as any).name : 'N/A',
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
                studentAttended: false
              },
              homework: {
                hasAssignment: !!session.homework?.assignment,
                hasSubmission: !!session.homework?.submission,
                hasGrade: !!session.homework?.grade,
                isLate: session.homework?.submission && session.homework?.assignment
                  ? new Date(session.homework.submission.submittedAt) > new Date(session.homework.assignment.deadline)
                  : false,
                // Include full homework details
                assignment: session.homework?.assignment || null,
                submission: session.homework?.submission || null,
                grade: session.homework?.grade || null
              },
              cancellationRequest: session.cancellationRequest || null,
              canAttend,
              canJoin: bothAttended,
              tutor: learningClass.tutorId,
              student: learningClass.studentId
            });
          }
        }
      }

      // Sort by date
      weekSessions.sort((a, b) =>
        new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
      );

      return {
        success: true,
        data: {
          weekStart,
          weekEnd,
          sessions: weekSessions,
          totalSessions: weekSessions.length
        }
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
      const session = learningClass.sessions.find(s => s.sessionNumber === sessionNumber);
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
        status: 'PENDING'
      };

      await learningClass.save();

      // Send notification to the other party
      try {
        const requester = await User.findById(userId);
        const requesterName = requester?.full_name || requester?.email || (isTutor ? 'Gia sư' : 'Học viên');
        const subject = await Subject.findById(learningClass.subject);
        const className = subject?.name || learningClass.title || 'Lớp học';
        const recipientId = isTutor ? learningClass.studentId.toString() : learningClass.tutorId.toString();

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
          cancellationRequest: session.cancellationRequest
        }
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
      const session = learningClass.sessions.find(s => s.sessionNumber === sessionNumber);
      if (!session) {
        throw new Error('Không tìm thấy buổi học');
      }

      if (session.status !== 'PENDING_CANCELLATION' || !session.cancellationRequest) {
        throw new Error('Không có yêu cầu huỷ buổi học nào đang chờ phê duyệt');
      }

      // Check if user is the one who should respond
      const requestedByRole = session.cancellationRequest.requestedBy;
      const shouldBeRespondedBy = requestedByRole === 'TUTOR' ? 'STUDENT' : 'TUTOR';
      const currentUserRole = isTutor ? 'TUTOR' : 'STUDENT';

      if (currentUserRole !== shouldBeRespondedBy) {
        throw new Error('Bạn không thể phản hồi yêu cầu do chính mình tạo');
      }

      if (action === 'APPROVE') {
        // Approve cancellation
        session.status = 'CANCELLED';
        session.cancellationRequest.status = 'APPROVED';
        session.notes = (session.notes || '') + `\nLý do huỷ: ${session.cancellationRequest.reason}`;

        await learningClass.save();

        // Send notification to requester
        try {
          const responder = await User.findById(userId);
          const responderName = responder?.full_name || responder?.email || (isTutor ? 'Gia sư' : 'Học viên');
          const subject = await Subject.findById(learningClass.subject);
          const className = subject?.name || learningClass.title || 'Lớp học';
          const requesterId = session.cancellationRequest.requestedBy === 'TUTOR'
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
            status: session.status
          }
        };
      } else {
        // Reject cancellation
        session.status = 'SCHEDULED';
        session.cancellationRequest.status = 'REJECTED';

        await learningClass.save();

        // Send notification to requester
        try {
          const responder = await User.findById(userId);
          const responderName = responder?.full_name || responder?.email || (isTutor ? 'Gia sư' : 'Học viên');
          const subject = await Subject.findById(learningClass.subject);
          const className = subject?.name || learningClass.title || 'Lớp học';
          const requesterId = session.cancellationRequest.requestedBy === 'TUTOR'
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
            status: session.status
          }
        };
      }
    } catch (error: any) {
      logger.error('Respond to cancellation request error:', error);
      throw new Error(error.message || 'Không thể phản hồi yêu cầu huỷ buổi học');
    }
  }
}

export const classService = new ClassService();