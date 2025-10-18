import { LearningClass } from '../../models/LearningClass';
import { User } from '../../models/User';
import { Subject } from '../../models/Subject';
import { logger } from '../../utils/logger';

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
}

export const classService = new ClassService();