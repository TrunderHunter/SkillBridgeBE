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

      // Prevent student from contacting themselves
      if (tutorPost.tutorId === studentId) {
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
        tutorId: tutorPost.tutorId,
        tutorPostId: requestData.tutorPostId,
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

      // TODO: Send notification to tutor
      // await notificationService.notifyNewContactRequest(tutorPost.tutorId, contactRequest._id);

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
   * Get contact requests for student
   */
  async getStudentRequests(studentId: string, filters: ContactRequestFilters) {
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

      const query: any = { studentId };

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
          .populate('tutorId', 'full_name avatar_url')
          .populate('tutorPostId', 'title pricePerSession')
          .populate('subject', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        ContactRequest.countDocuments(query)
      ]);

      return {
        success: true,
        data: {
          requests,
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
          .populate({
            path: 'tutorPostId',
            select: 'title description pricePerSession sessionDuration teachingMode teachingSchedule address'
          })
          .populate('subject', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        ContactRequest.countDocuments(query)
      ]);

      return {
        success: true,
        data: {
          requests,
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

      // TODO: Send notification to student
      // await notificationService.notifyRequestResponse(contactRequest.studentId, requestId, responseData.action);

      return {
        success: true,
        message: responseData.action === 'ACCEPT' ? 
          'Chấp nhận yêu cầu thành công' : 'Từ chối yêu cầu thành công',
        data: contactRequest
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

      // Check if class already exists for this request
      const existingClass = await LearningClass.findOne({
        contactRequestId: classData.contactRequestId
      });

      if (existingClass) {
        throw new Error('Lớp học đã được tạo cho yêu cầu này');
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
        learningMode: contactRequest.learningMode === 'FLEXIBLE' ? 
          (classData.location ? 'OFFLINE' : 'ONLINE') : 
          contactRequest.learningMode,
        
        schedule: classData.schedule,
        startDate,
        expectedEndDate,
        location: classData.location,
        onlineInfo: classData.onlineInfo,
        
        sessions: [], // Will be generated separately
        totalAmount,
      });

      await learningClass.save();

      // Generate initial sessions
      await this.generateLearningSessions(learningClass._id); // ✅ Fix tên hàm

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
   * ✅ Fix tên hàm: Generate learning sessions for a class
   */
  private async generateLearningSessions(classId: string) {
    try {
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) return;

      const sessions = [];
      let sessionNumber = 1;
      let currentDate = new Date(learningClass.startDate);
      
      while (sessionNumber <= learningClass.totalSessions) {
        const dayOfWeek = currentDate.getDay();
        
        if (learningClass.schedule.dayOfWeek.includes(dayOfWeek)) {
          sessions.push({
            sessionNumber,
            scheduledDate: new Date(currentDate),
            duration: learningClass.sessionDuration,
            status: 'SCHEDULED' as const,
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