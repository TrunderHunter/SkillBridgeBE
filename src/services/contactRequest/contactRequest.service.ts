import { ContactRequest, IContactRequest } from '../../models/ContactRequest';
import { TutorPost } from '../../models/TutorPost';
import { User } from '../../models/User';
import { Subject } from '../../models/Subject';
import { LearningClass } from '../../models/LearningClass';
import { logger } from '../../utils/logger';
import {
  CreateContactRequestInput,
  TutorResponseInput,
  CreateLearningClassInput,
  ContactRequestFilters
} from '../../types/contactRequest.types';
import {
  notifyContactRequestSent,
  notifyContactRequestResponded
} from '../notification/notification.helpers';
import { mapContactRequestToResponse } from '../../utils/mappers/contactRequest.mapper';
import { Post } from '../../models/Post';

class ContactRequestService {
  /**
   * Create new contact request from student to tutor
   */
  async createContactRequest(
    studentId: string,
    requestData: CreateContactRequestInput
  ) {
    try {
      // Validate tutor post exists and is active
      const tutorPost = await TutorPost.findOne({
        _id: requestData.tutorPostId,
        status: 'ACTIVE'
      }).populate('tutorId');

      if (!tutorPost) {
        throw new Error('Bài đăng gia sư không tồn tại hoặc đã bị khóa');
      }

      // Get tutorId - handle both populated and non-populated cases
      const tutorId = typeof tutorPost.tutorId === 'object' && tutorPost.tutorId !== null && '_id' in tutorPost.tutorId
        ? (tutorPost.tutorId as any)._id.toString()
        : tutorPost.tutorId.toString();

      // Prevent student from contacting themselves
      if (tutorId === studentId) {
        throw new Error('Bạn không thể gửi yêu cầu đến chính mình');
      }

      // Check if subject is in tutor's subjects list
      if (!tutorPost.subjects.includes(requestData.subject)) {
        throw new Error('Môn học không có trong danh sách dạy của gia sư');
      }

      // Check if student already has pending request for this post
      const existingRequest = await ContactRequest.findOne({
        studentId,
        tutorPostId: requestData.tutorPostId,
        status: 'PENDING'
      });

      if (existingRequest) {
        throw new Error('Bạn đã có yêu cầu đang chờ xử lý cho bài đăng này');
      }

      // Get student info for contact details
      const student = await User.findById(studentId);
      if (!student) {
        throw new Error('Không tìm thấy thông tin học viên');
      }

      // Create contact request
      const contactRequest = new ContactRequest({
        studentId,
        tutorId: tutorId,
        tutorPostId: requestData.tutorPostId,
        initiatedBy: 'STUDENT',
        subject: requestData.subject,
        message: requestData.message,
        preferredSchedule: requestData.preferredSchedule,
        expectedPrice: requestData.expectedPrice,
        sessionDuration: requestData.sessionDuration || 60,
        learningMode: requestData.learningMode,
        studentContact: {
          phone: requestData.studentContact.phone || student.phone_number,
          email: requestData.studentContact.email || student.email,
          preferredContactMethod: requestData.studentContact.preferredContactMethod,
        },
      });

      await contactRequest.save();

      // Send notification to tutor
      try {
        const studentName = student.full_name || student.email || 'Học viên';
        await notifyContactRequestSent(
          tutorId,
          studentName,
          contactRequest._id
        );
      } catch (notifError) {
        logger.error('Failed to send notification:', notifError);
        // Don't throw error, just log it
      }

      return {
        success: true,
        message: 'Gửi yêu cầu liên hệ thành công',
        data: contactRequest
      };
    } catch (error: any) {
      logger.error('Create contact request error:', error);
      throw new Error(error.message || 'Không thể gửi yêu cầu liên hệ');
    }
  }

  /**
   * Tutor creates a teach request to a student's post
   */
  async createRequestFromTutor(
    tutorId: string,
    requestData: {
      tutorPostId: string;
      studentPostId: string;
      subject: string;
      message: string;
      preferredSchedule?: string;
      expectedPrice?: number;
      sessionDuration?: number;
      learningMode: 'ONLINE' | 'OFFLINE' | 'FLEXIBLE';
    }
  ) {
    try {
      // Validate tutor's post ownership and status
      const tutorPost = await TutorPost.findOne({
        _id: requestData.tutorPostId,
        tutorId,
        status: 'ACTIVE'
      }).populate('subjects');

      if (!tutorPost) {
        throw new Error('Bài đăng gia sư không hợp lệ hoặc không thuộc sở hữu của bạn');
      }

      // Validate student post
      const studentPost = await Post.findById(requestData.studentPostId).lean();
      if (!studentPost || !studentPost.author_id) {
        throw new Error('Bài đăng của học viên không tồn tại');
      }

      // Prevent contacting self (in case roles overlap in system)
      const studentId =
        typeof studentPost.author_id === 'object' && (studentPost as any).author_id._id
          ? (studentPost as any).author_id._id.toString()
          : studentPost.author_id.toString();
      if (studentId === tutorId) {
        throw new Error('Bạn không thể gửi yêu cầu đến chính mình');
      }

      // Validate subject exists in tutor post subjects
      const subjectIds = (tutorPost.subjects || []).map((s: any) =>
        typeof s === 'object' && s._id ? s._id.toString() : s.toString()
      );
      if (!subjectIds.includes(requestData.subject)) {
        throw new Error('Môn học không có trong danh sách dạy của bài đăng gia sư');
      }

      // Check existing pending request between tutor and this student for the same tutorPost
      const existing = await ContactRequest.findOne({
        studentId,
        tutorId,
        tutorPostId: requestData.tutorPostId,
        status: 'PENDING'
      });
      if (existing) {
        throw new Error('Bạn đã gửi yêu cầu và đang chờ phản hồi từ học viên');
      }

      // Build student contact info from student user
      const studentUser = await User.findById(studentId);

      const contactRequest = new ContactRequest({
        studentId,
        tutorId,
        tutorPostId: requestData.tutorPostId,
        studentPostId: requestData.studentPostId, // Save student post ID when tutor initiates
        initiatedBy: 'TUTOR',
        subject: requestData.subject,
        message: requestData.message,
        preferredSchedule: requestData.preferredSchedule,
        expectedPrice: requestData.expectedPrice ?? tutorPost.pricePerSession,
        sessionDuration: requestData.sessionDuration || tutorPost.sessionDuration || 60,
        learningMode: requestData.learningMode,
        studentContact: {
          phone: (studentUser as any)?.phone_number,
          email: studentUser?.email,
          preferredContactMethod: 'both',
        },
      });

      await contactRequest.save();

      // Notify student about tutor's teach request
      try {
        const tutor = await User.findById(tutorId);
        const tutorName = tutor?.full_name || tutor?.email || 'Gia sư';
        const { notifyTeachRequestSent } = await import('../notification/notification.helpers');
        await notifyTeachRequestSent(studentId, tutorName, contactRequest._id);
      } catch (notifErr) {
        logger.error('Failed to send teach request notification:', notifErr);
      }

      // Populate minimal for response
      const populated = await ContactRequest.findById(contactRequest._id)
        .populate('subject', 'name')
        .populate('tutorPostId', 'title pricePerSession')
        .lean();

      return {
        success: true,
        message: 'Đã gửi đề nghị dạy tới học viên',
        data: populated ? mapContactRequestToResponse(populated) : contactRequest,
      };
    } catch (error: any) {
      logger.error('Create request from tutor error:', error);
      throw new Error(error.message || 'Không thể gửi đề nghị dạy');
    }
  }

  /**
   * Get contact requests for student
   */
  async getStudentRequests(studentId: string, filters: ContactRequestFilters) {
    try {
      const {
        status,
        subject,
        learningMode,
        initiatedBy,
        dateFrom,
        dateTo,
        page = 1,
        limit = 10
      } = filters;

      const query: any = { studentId };

      if (status) query.status = status;
      if (subject) query.subject = subject;
      if (learningMode) query.learningMode = learningMode;
      if (initiatedBy) query.initiatedBy = initiatedBy;
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const skip = (page - 1) * limit;

      const [requests, total] = await Promise.all([
        ContactRequest.find(query)
          .populate('tutorId', 'full_name avatar_url email phone_number')
          .populate({
            path: 'tutorPostId',
            select:
              'title description pricePerSession sessionDuration teachingMode teachingSchedule address'
          })
          .populate('studentPostId', 'title content subjects grade_levels hourly_rate is_online availability location')
          .populate('subject', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ContactRequest.countDocuments(query)
      ]);
      const learningClassMap = await this.buildLearningClassMap(requests);

      // Transform requests to frontend format
      const transformedRequests = requests.map((request) => {
        const mapped = mapContactRequestToResponse(request);
        const learningClass = learningClassMap[mapped.id];
        if (learningClass) {
          mapped.learningClass = learningClass;
        }
        return mapped;
      });

      return {
        success: true,
        data: {
          requests: transformedRequests,
          pagination: {
            current: page,
            total: Math.ceil(total / limit),
            count: total
          }
        }
      };
    } catch (error: any) {
      logger.error('Get student requests error:', error);
      throw new Error('Không thể lấy danh sách yêu cầu');
    }
  }

  /**
   * Get contact requests for tutor
   */
  async getTutorRequests(tutorId: string, filters: ContactRequestFilters) {
    try {
      const {
        status,
        subject,
        learningMode,
        dateFrom,
        dateTo,
        page = 1,
        limit = 10
      } = filters;

      const query: any = { tutorId };

      if (status) query.status = status;
      if (subject) query.subject = subject;
      if (learningMode) query.learningMode = learningMode;
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const skip = (page - 1) * limit;

      const [requests, total] = await Promise.all([
        ContactRequest.find(query)
          .populate('studentId', 'full_name avatar_url phone_number email')
          .populate('tutorId', 'full_name avatar_url email phone_number')
          .populate({
            path: 'tutorPostId',
            select: 'title description pricePerSession sessionDuration teachingMode teachingSchedule address'
          })
          .populate('studentPostId', 'title content subjects grade_levels hourly_rate is_online availability location')
          .populate('subject', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ContactRequest.countDocuments(query)
      ]);
      const learningClassMap = await this.buildLearningClassMap(requests);

      // Transform requests to frontend format
      const transformedRequests = requests.map((request) => {
        const mapped = mapContactRequestToResponse(request);
        const learningClass = learningClassMap[mapped.id];
        if (learningClass) {
          mapped.learningClass = learningClass;
        }
        return mapped;
      });

      return {
        success: true,
        data: {
          requests: transformedRequests,
          pagination: {
            current: page,
            total: Math.ceil(total / limit),
            count: total
          }
        }
      };
    } catch (error: any) {
      logger.error('Get tutor requests error:', error);
      throw new Error('Không thể lấy danh sách yêu cầu');
    }
  }

  /**
   * Student responds to a tutor-initiated request
   */
  async studentRespondToRequest(
    studentId: string,
    requestId: string,
    responseData: { action: 'ACCEPT' | 'REJECT'; message?: string }
  ) {
    try {
      const contactRequest = await ContactRequest.findOne({
        _id: requestId,
        studentId,
        status: 'PENDING'
      });

      if (!contactRequest) {
        throw new Error('Không tìm thấy yêu cầu hoặc yêu cầu đã được xử lý');
      }

      if (responseData.action === 'ACCEPT') {
        contactRequest.status = 'ACCEPTED';
      } else {
        contactRequest.status = 'REJECTED';
      }

      // Build a fresh tutorResponse object with only safe fields to avoid
      // accidentally persisting undefined subdocuments (e.g. counterOffer: undefined).
      const nextTutorResponse: any = {};
      if (responseData?.message) {
        nextTutorResponse.message = responseData.message;
      }
      if (responseData.action === 'ACCEPT') {
        nextTutorResponse.acceptedAt = new Date();
      } else {
        nextTutorResponse.rejectedAt = new Date();
      }
      contactRequest.tutorResponse = nextTutorResponse;

      await contactRequest.save();

      // Notify tutor about student's decision
      try {
        const student = await User.findById(studentId);
        const studentName = student?.full_name || student?.email || 'Học viên';
        const { notifyTeachRequestResponded } = await import('../notification/notification.helpers');
        await notifyTeachRequestResponded(
          contactRequest.tutorId.toString(),
          studentName,
          responseData.action,
          contactRequest._id
        );
      } catch (notifErr) {
        logger.error('Failed to notify tutor about student response:', notifErr);
      }

      const populatedRequest = await ContactRequest.findById(contactRequest._id)
        .populate('studentId', 'full_name avatar_url email phone_number')
        .populate('tutorId', 'full_name avatar_url email phone_number')
        .populate('tutorPostId', 'title description pricePerSession sessionDuration')
        .populate('subject', 'name')
        .lean();

      const transformed = populatedRequest ? mapContactRequestToResponse(populatedRequest) : null;

      return {
        success: true,
        message:
          responseData.action === 'ACCEPT'
            ? 'Bạn đã chấp nhận đề nghị dạy. Gia sư sẽ tạo lớp học.'
            : 'Bạn đã từ chối đề nghị dạy.',
        data: transformed,
      };
    } catch (error: any) {
      logger.error('Student respond to request error:', error);
      throw new Error(error.message || 'Không thể phản hồi đề nghị');
    }
  }

  /**
   * Tutor responds to contact request
   */
  async respondToRequest(
    tutorId: string,
    requestId: string,
    responseData: TutorResponseInput
  ) {
    try {
      const contactRequest = await ContactRequest.findOne({
        _id: requestId,
        tutorId,
        status: 'PENDING'
      });

      if (!contactRequest) {
        throw new Error('Không tìm thấy yêu cầu hoặc yêu cầu đã được xử lý');
      }

      // Check if request is expired
      if (contactRequest.expiresAt < new Date()) {
        contactRequest.status = 'EXPIRED';
        await contactRequest.save();
        throw new Error('Yêu cầu đã hết hạn');
      }

      // Update request based on action
      if (responseData.action === 'ACCEPT') {
        contactRequest.status = 'ACCEPTED';
        contactRequest.tutorResponse = {
          message: responseData.message,
          acceptedAt: new Date(),
          counterOffer: responseData.counterOffer,
        };
      } else {
        contactRequest.status = 'REJECTED';
        contactRequest.tutorResponse = {
          message: responseData.message,
          rejectedAt: new Date(),
          rejectionReason: responseData.rejectionReason,
        };
      }

      await contactRequest.save();

      // Send notification to student
      try {
        const tutor = await User.findById(tutorId);
        const tutorName = tutor?.full_name || tutor?.email || 'Gia sư';
        await notifyContactRequestResponded(
          contactRequest.studentId.toString(),
          tutorName,
          responseData.action,
          contactRequest._id
        );
      } catch (notifError) {
        logger.error('Failed to send notification:', notifError);
        // Don't throw error, just log it
      }

      // Populate and transform before returning
      const populatedRequest = await ContactRequest.findById(contactRequest._id)
        .populate('studentId', 'full_name avatar_url email phone_number')
        .populate('tutorId', 'full_name avatar_url email phone_number')
        .populate('tutorPostId', 'title description pricePerSession sessionDuration')
        .populate('subject', 'name')
        .lean();

      const transformedRequest = populatedRequest ? mapContactRequestToResponse(populatedRequest) : null;

      return {
        success: true,
        message: responseData.action === 'ACCEPT' ?
          'Chấp nhận yêu cầu thành công' : 'Từ chối yêu cầu thành công',
        data: transformedRequest
      };
    } catch (error: any) {
      logger.error('Respond to request error:', error);
      throw new Error(error.message || 'Không thể phản hồi yêu cầu');
    }
  }

  /**
   * Create learning class from accepted request
   */
  async createLearningClass(
    tutorId: string,
    classData: CreateLearningClassInput
  ) {
    try {
      // Validate contact request
      const contactRequest = await ContactRequest.findOne({
        _id: classData.contactRequestId,
        tutorId,
        status: 'ACCEPTED'
      }).populate('tutorPostId');

      if (!contactRequest) {
        throw new Error('Không tìm thấy yêu cầu đã được chấp nhận');
      }

      // Check if a non-cancelled class already exists for this request
      const existingClass = await LearningClass.findOne({
        contactRequestId: classData.contactRequestId,
        status: { $ne: 'CANCELLED' },
      });

      if (existingClass) {
        throw new Error('Đã tồn tại lớp học đang hoạt động hoặc đã hoàn thành cho yêu cầu này');
      }

      // ✅ KIỂM TRA TRÙNG LỊCH HỌC
      await this.validateScheduleConflict(
        tutorId,
        classData.schedule,
        new Date(classData.startDate)
      );

      const tutorPost = contactRequest.tutorPostId as any;

      // Calculate dates and amount
      const startDate = new Date(classData.startDate);
      const totalAmount = tutorPost.pricePerSession * classData.totalSessions;

      // Estimate end date based on schedule
      const sessionsPerWeek = classData.schedule.dayOfWeek.length;
      const totalWeeks = Math.ceil(classData.totalSessions / sessionsPerWeek);
      const expectedEndDate = new Date(startDate);
      expectedEndDate.setDate(expectedEndDate.getDate() + (totalWeeks * 7));

      // Auto-provision online meeting if needed
      const determinedLearningMode = contactRequest.learningMode === 'FLEXIBLE'
        ? (classData.location ? 'OFFLINE' : 'ONLINE')
        : contactRequest.learningMode;

      let finalOnlineInfo = classData.onlineInfo;
      if (determinedLearningMode === 'ONLINE') {
        const missingMeetingLink = !finalOnlineInfo?.meetingLink;
        if (missingMeetingLink) {
          try {
            const { provisionOnlineMeeting } = await import('../meeting/meeting.service');
            const provisioned = await provisionOnlineMeeting(finalOnlineInfo?.platform || 'OTHER', {
              title: classData.title,
              startDate,
              schedule: classData.schedule,
            });
            if (provisioned) {
              finalOnlineInfo = provisioned;
            }
          } catch (provisionErr) {
            logger.warn('Online meeting provisioning failed. Proceeding without auto meeting.', provisionErr);
          }
          // Fallback: ensure a shared online room link even if provisioning fails
          if (!finalOnlineInfo || !finalOnlineInfo.meetingLink) {
            finalOnlineInfo = {
              platform: 'OTHER',
              meetingLink: `https://8x8.vc/${process.env.JITSI_TENANT || 'skillbridge'}/skillbridge-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
            } as any;
          }
        }
      }

      // Create learning class
      const learningClass = new LearningClass({
        contactRequestId: classData.contactRequestId,
        studentId: contactRequest.studentId,
        tutorId: contactRequest.tutorId,
        tutorPostId: contactRequest.tutorPostId,
        subject: contactRequest.subject,

        title: classData.title,
        description: classData.description,
        pricePerSession: tutorPost.pricePerSession,
        sessionDuration: contactRequest.sessionDuration,
        totalSessions: classData.totalSessions,
        learningMode: determinedLearningMode,

        schedule: classData.schedule,
        startDate,
        expectedEndDate,
        location: classData.location,
        onlineInfo: finalOnlineInfo,

        sessions: [], // Will be generated separately
        totalAmount,
      });

      await learningClass.save();

      // Generate initial sessions
      await this.generateLearningSessions(learningClass._id); // ✅ Fix tên hàm

      // Send notification to student
      try {
        const tutor = await User.findById(tutorId);
        const tutorName = tutor?.full_name || tutor?.email || 'Gia sư';
        const { notifyClassCreated } = await import('../notification/notification.helpers');
        await notifyClassCreated(
          contactRequest.studentId.toString(),
          tutorName,
          learningClass.title,
          learningClass._id.toString()
        );
      } catch (notifError) {
        logger.error('Failed to send notification:', notifError);
        // Don't throw error, just log it
      }

      return {
        success: true,
        message: 'Tạo lớp học thành công',
        data: learningClass
      };
    } catch (error: any) {
      logger.error('Create learning class error:', error);
      throw new Error(error.message || 'Không thể tạo lớp học');
    }
  }

  /**
   * ✅ Fix: Generate learning sessions with correct time
   */
  private async generateLearningSessions(classId: string) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) return;

      const sessions = [];
      let sessionNumber = 1;
      let currentDate = new Date(learningClass.startDate);

      // Parse startTime from schedule (format: "HH:mm")
      const [startHour, startMinute] = learningClass.schedule.startTime.split(':').map(Number);

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
              checkedIn: false,
              tutorAttended: false,
              studentAttended: false,
            },
          });
          sessionNumber++;
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);

        // Safety check to prevent infinite loop
        if (currentDate.getTime() > Date.now() + (365 * 24 * 60 * 60 * 1000)) {
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
   * Build a map of contactRequestId -> learningClass info to enrich responses
   */
  private async buildLearningClassMap(requests: any[]) {
    const requestIds = (requests || [])
      .map((req) => {
        if (!req) return null;
        if (typeof req._id === 'object' && req._id !== null && req._id.toString) {
          return req._id.toString();
        }
        if (typeof req._id === 'string') return req._id;
        if (req.id) return req.id.toString?.() ?? req.id;
        return null;
      })
      .filter((id): id is string => Boolean(id));

    if (requestIds.length === 0) {
      return {};
    }

    const learningClasses = await LearningClass.find({
      contactRequestId: { $in: requestIds },
      status: { $ne: 'CANCELLED' },
    })
      .select('_id contactRequestId title status schedule startDate totalSessions learningMode')
      .lean();

    return (learningClasses || []).reduce<Record<string, any>>((acc, cls) => {
      const contactRequestId = (cls as any)?.contactRequestId;
      const key =
        (typeof contactRequestId === 'object' && contactRequestId !== null && contactRequestId.toString)
          ? contactRequestId.toString()
          : contactRequestId;
      if (!key) {
        return acc;
      }

      acc[key] = {
        id: cls._id?.toString?.() || cls._id,
        title: cls.title,
        status: cls.status,
        startDate: cls.startDate,
        schedule: cls.schedule,
        totalSessions: cls.totalSessions,
        learningMode: cls.learningMode,
      };
      return acc;
    }, {});
  }

  /**
   * Cancel contact request (by student)
   */
  async cancelRequest(studentId: string, requestId: string) {
    try {
      const contactRequest = await ContactRequest.findOne({
        _id: requestId,
        studentId,
        status: { $in: ['PENDING', 'ACCEPTED'] }
      });

      if (!contactRequest) {
        throw new Error('Không tìm thấy yêu cầu hoặc yêu cầu không thể hủy');
      }

      contactRequest.status = 'CANCELLED';
      await contactRequest.save();

      return {
        success: true,
        message: 'Hủy yêu cầu thành công'
      };
    } catch (error: any) {
      logger.error('Cancel request error:', error);
      throw new Error('Không thể hủy yêu cầu');
    }
  }

  /**
   * ✅ Validate schedule conflict - Kiểm tra trùng lịch học
   */
  private async validateScheduleConflict(
    tutorId: string,
    newSchedule: { dayOfWeek: number[]; startTime: string; endTime: string },
    startDate: Date
  ): Promise<void> {
    try {
      // Lấy tất cả lớp học ACTIVE của gia sư
      const activeClasses = await LearningClass.find({
        tutorId,
        status: { $in: ['ACTIVE', 'PAUSED'] },
        // Chỉ check các lớp chưa kết thúc
        $or: [
          { actualEndDate: { $exists: false } },
          { actualEndDate: { $gt: startDate } }
        ]
      });

      if (activeClasses.length === 0) {
        return; // Không có lớp nào, OK
      }

      // Kiểm tra từng lớp học
      for (const existingClass of activeClasses) {
        const existingSchedule = existingClass.schedule;

        // Kiểm tra xem có ngày nào trùng nhau không
        const commonDays = newSchedule.dayOfWeek.filter(day =>
          existingSchedule.dayOfWeek.includes(day)
        );

        if (commonDays.length === 0) {
          continue; // Không có ngày trùng, check lớp tiếp theo
        }

        // Có ngày trùng, kiểm tra giờ học
        const isTimeOverlap = this.checkTimeOverlap(
          newSchedule.startTime,
          newSchedule.endTime,
          existingSchedule.startTime,
          existingSchedule.endTime
        );

        if (isTimeOverlap) {
          // Tìm tên ngày trùng
          const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
          const conflictDays = commonDays.map(d => dayNames[d]).join(', ');

          throw new Error(
            `Lịch học bị trùng với lớp "${existingClass.title}".\n` +
            `Ngày trùng: ${conflictDays}\n` +
            `Giờ học hiện tại: ${existingSchedule.startTime} - ${existingSchedule.endTime}\n` +
            `Giờ học mới: ${newSchedule.startTime} - ${newSchedule.endTime}\n` +
            `Vui lòng chọn lịch khác hoặc điều chỉnh giờ học.`
          );
        }
      }
    } catch (error: any) {
      // Re-throw validation errors
      if (error.message.includes('Lịch học bị trùng')) {
        throw error;
      }
      logger.error('Validate schedule conflict error:', error);
      throw new Error('Không thể kiểm tra lịch học');
    }
  }

  /**
   * ✅ Check if two time ranges overlap
   */
  private checkTimeOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    // Convert "HH:mm" to minutes
    const toMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const start1Min = toMinutes(start1);
    const end1Min = toMinutes(end1);
    const start2Min = toMinutes(start2);
    const end2Min = toMinutes(end2);

    // Check overlap: (start1 < end2) && (start2 < end1)
    return start1Min < end2Min && start2Min < end1Min;
  }
}



export const contactRequestService = new ContactRequestService();