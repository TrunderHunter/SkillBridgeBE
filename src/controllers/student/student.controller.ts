import { Request, Response } from 'express';
import { studentService } from '../../services/student/student.service';
import { UserRole } from '../../types/user.types';
import { logger } from '../../utils/logger';
import { sendSuccess, sendError } from '../../utils/response';

export class StudentController {
  /**
   * @desc    Tạo hồ sơ học viên mới
   * @route   POST /api/v1/students/profiles
   * @access  Private (PARENT only)
   */
  static async createStudentProfile(req: Request, res: Response): Promise<void> {
  
    try {
      const parentId = req.user?.id;
      const profileData = req.body;

     

      // Double check role (middleware đã check rồi)
      if (req.user?.role !== UserRole.PARENT) {
        sendError(res, 'Chỉ phụ huynh mới có thể tạo hồ sơ học viên', undefined, 403);
        return;
      }

      const result = await studentService.createStudentProfile(parentId!, profileData);

      logger.info(`Parent ${parentId} created student profile: ${result.student.id}`);

      sendSuccess(
        res,
        'Tạo hồ sơ học viên thành công. Vui lòng lưu mật khẩu tạm thời.',
        {
          student: result.student,
          temp_password: result.temp_password,
          note: 'Học viên cần đổi mật khẩu khi đăng nhập lần đầu'
        },
        201
      );

    } catch (error: any) {
     
      logger.error('Create student profile error:', error);

      if (error.message.includes('Email đã được sử dụng')) {
        sendError(res, 'Email đã được sử dụng trong hệ thống', undefined, 400);
        return;
      }

      if (error.message.includes('Số điện thoại đã được sử dụng')) {
        sendError(res, 'Số điện thoại đã được sử dụng trong hệ thống', undefined, 400);
        return;
      }

      if (error.message.includes('chỉ có thể tạo tối đa')) {
        sendError(res, error.message, undefined, 400);
        return;
      }

      sendError(res, error.message || 'Lỗi server khi tạo hồ sơ học viên', undefined, 500);
    }
  }

  /**
   * @desc    Lấy danh sách hồ sơ học viên của phụ huynh
   * @route   GET /api/v1/students/profiles
   * @access  Private (PARENT only)
   */
  static async getStudentProfiles(req: Request, res: Response): Promise<void> {
    try {
      const parentId = req.user?.id;

      const students = await studentService.getStudentProfilesByParent(parentId!);

      sendSuccess(
        res,
        'Lấy danh sách hồ sơ học viên thành công',
        {
          students,
          total: students.length,
          message: students.length === 0 ? 'Chưa có hồ sơ học viên nào. Hãy tạo hồ sơ đầu tiên cho con bạn.' : undefined
        }
      );

    } catch (error: any) {
      logger.error('Get student profiles error:', error);
      sendError(res, error.message || 'Lỗi server khi lấy danh sách hồ sơ học viên', undefined, 500);
    }
  }

  /**
   * @desc    Lấy chi tiết hồ sơ học viên
   * @route   GET /api/v1/students/profiles/:studentId
   * @access  Private (PARENT only - chỉ xem con của mình)
   */
  static async getStudentProfile(req: Request, res: Response): Promise<void> {
    try {
      const parentId = req.user?.id;
      const studentId = req.params.studentId;

      const student = await studentService.getStudentProfile(studentId, parentId!);

      sendSuccess(
        res,
        'Lấy chi tiết hồ sơ học viên thành công',
        { student }
      );

    } catch (error: any) {
      logger.error('Get student profile error:', error);

      if (error.message.includes('Không tìm thấy') || error.message.includes('không có quyền')) {
        sendError(res, error.message, undefined, 404);
        return;
      }

      sendError(res, error.message || 'Lỗi server khi lấy chi tiết hồ sơ học viên', undefined, 500);
    }
  }

  /**
   * @desc    Cập nhật hồ sơ học viên
   * @route   PUT /api/v1/students/profiles/:studentId
   * @access  Private (PARENT only - chỉ sửa con của mình)
   */
  static async updateStudentProfile(req: Request, res: Response): Promise<void> {
    try {
      const parentId = req.user?.id;
      const studentId = req.params.studentId;
      const updateData = req.body;

      const updatedStudent = await studentService.updateStudentProfile(
        studentId, 
        parentId!, 
        updateData
      );

      logger.info(`Parent ${parentId} updated student profile: ${studentId}`);

      sendSuccess(
        res,
        'Cập nhật hồ sơ học viên thành công',
        { student: updatedStudent }
      );

    } catch (error: any) {
      logger.error('Update student profile error:', error);

      if (error.message.includes('Không tìm thấy') || error.message.includes('không có quyền')) {
        sendError(res, error.message, undefined, 404);
        return;
      }

      sendError(res, error.message || 'Lỗi server khi cập nhật hồ sơ học viên', undefined, 500);
    }
  }

  /**
   * @desc    Xóa hồ sơ học viên (soft delete)
   * @route   DELETE /api/v1/students/profiles/:studentId
   * @access  Private (PARENT only - chỉ xóa con của mình)
   */
  static async deleteStudentProfile(req: Request, res: Response): Promise<void> {
    try {
      const parentId = req.user?.id;
      const studentId = req.params.studentId;

      await studentService.deleteStudentProfile(studentId, parentId!);

      logger.info(`Parent ${parentId} deleted student profile: ${studentId}`);

      sendSuccess(
        res,
        'Xóa hồ sơ học viên thành công. Hồ sơ đã được chuyển vào thùng rác.',
        null
      );

    } catch (error: any) {
      logger.error('Delete student profile error:', error);

      if (error.message.includes('Không tìm thấy') || error.message.includes('không có quyền')) {
        sendError(res, error.message, undefined, 404);
        return;
      }

      sendError(res, error.message || 'Lỗi server khi xóa hồ sơ học viên', undefined, 500);
    }
  }

  /**
   * @desc    Lấy thống kê hồ sơ học viên của phụ huynh
   * @route   GET /api/v1/students/profiles/stats
   * @access  Private (PARENT only)
   */
  static async getStudentStats(req: Request, res: Response): Promise<void> {
    try {
      const parentId = req.user?.id;

      const stats = await studentService.getStudentStats(parentId!);

      sendSuccess(
        res,
        'Lấy thống kê hồ sơ học viên thành công',
        stats
      );

    } catch (error: any) {
      logger.error('Get student stats error:', error);
      sendError(res, error.message || 'Lỗi server khi lấy thống kê', undefined, 500);
    }
  }

  /**
   * @desc    Tạo lại mật khẩu tạm thời cho học viên
   * @route   POST /api/v1/students/profiles/:studentId/reset-password
   * @access  Private (PARENT only)
   */
  static async resendStudentPassword(req: Request, res: Response): Promise<void> {
    try {
      const parentId = req.user?.id;
      const studentId = req.params.studentId;

      const result = await studentService.resendStudentPassword(studentId, parentId!);

      logger.info(`Parent ${parentId} reset password for student: ${studentId}`);

      sendSuccess(
        res,
        'Tạo mới mật khẩu tạm thời thành công. Vui lòng lưu mật khẩu mới.',
        {
          temp_password: result.temp_password,
          note: 'Học viên cần đổi mật khẩu khi đăng nhập lần đầu'
        }
      );

    } catch (error: any) {
      logger.error('Resend student password error:', error);

      if (error.message.includes('Không tìm thấy') || error.message.includes('không có quyền')) {
        sendError(res, error.message, undefined, 404);
        return;
      }

      sendError(res, error.message || 'Lỗi server khi tạo lại mật khẩu', undefined, 500);
    }
  }
}