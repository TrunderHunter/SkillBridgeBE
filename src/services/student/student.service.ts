import bcrypt from 'bcryptjs'; // ← SỬA: dùng bcryptjs
import { User } from '../../models';
import { 
  UserRole, 
  UserStatus, 
  IUserResponse 
} from '../../types';
import { logger } from '../../utils/logger';

export interface IStudentProfileInput {
  full_name: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  phone_number?: string;
  address?: string;
  grade?: string;
  school?: string;
  subjects?: string[];
  learning_goals?: string;
  preferred_schedule?: string;
  special_requirements?: string;
}

export interface IStudentCreateResponse {
  student: IUserResponse;
  temp_password: string;
}

export interface IStudentStatsResponse {
  total_students: number;
  active_students: number;
  by_grade: Array<{ grade: string; count: number }>;
  by_subject: Array<{ subject: string; count: number }>;
  recent_students: IUserResponse[];
}

class StudentService {
  private generateTempPassword(): string {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    
    let password = '';
    for (let i = 0; i < 3; i++) {
      password += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    for (let i = 0; i < 5; i++) {
      password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    
    return password;
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  private generateStudentEmail(): string {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 10000);
    
    // ✅ Format đúng với regex validation
    const email = `student.${timestamp}.${randomNum}@skillbridge.edu.vn`;
    
    return email;
  }

  async createStudentProfile(
    parentId: string, 
    profileData: IStudentProfileInput
  ): Promise<IStudentCreateResponse> {
    const startTime = Date.now();
    
    
    try {
      // 1. Verify parent exists and is active
      const parent = await User.findOne({
        _id: parentId,
        role: UserRole.PARENT,
        status: UserStatus.ACTIVE
      });

      if (!parent) {
        throw new Error('Phụ huynh không tồn tại hoặc chưa được kích hoạt');
      }

      // 2. Check student limit
      const existingStudents = await User.countDocuments({
        parent_id: parentId,
        role: UserRole.STUDENT,
        status: { $ne: UserStatus.DELETED }
      });

      const MAX_STUDENTS_PER_PARENT = 10;
      if (existingStudents >= MAX_STUDENTS_PER_PARENT) {
        throw new Error(`Bạn chỉ có thể tạo tối đa ${MAX_STUDENTS_PER_PARENT} hồ sơ học viên`);
      }

      // 3. Generate credentials
      const tempPassword = this.generateTempPassword();
      const studentEmail = this.generateStudentEmail();
      
      const hashedPassword = await this.hashPassword(tempPassword);

      // 4. Create student user 
      const student = new User({
        full_name: profileData.full_name,
        email: studentEmail,
        password_hash: hashedPassword,
        phone_number: profileData.phone_number,
        address: profileData.address || parent.address,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        parent_id: parentId,
        
        // Student specific fields
        date_of_birth: profileData.date_of_birth ? new Date(profileData.date_of_birth) : undefined,
        gender: profileData.gender,
        grade: profileData.grade,
        school: profileData.school,
        subjects: profileData.subjects || [],
        learning_goals: profileData.learning_goals,
        preferred_schedule: profileData.preferred_schedule,
        special_requirements: profileData.special_requirements,
      });

      await student.save();

      // 5. Prepare response
      const studentResponse: IUserResponse = {
        id: student._id.toString(), // ← SỬA: Convert to string
        full_name: student.full_name,
        email: student.email,
        phone_number: student.phone_number,
        avatar_url: student.avatar_url,
        role: student.role,
        status: student.status,
        address: student.address,
        parent_id: student.parent_id,
        date_of_birth: student.date_of_birth,
        gender: student.gender,
        grade: student.grade,
        school: student.school,
        subjects: student.subjects,
        learning_goals: student.learning_goals,
        preferred_schedule: student.preferred_schedule,
        special_requirements: student.special_requirements,
        created_at: student.created_at!,
        updated_at: student.updated_at!,
      };

      logger.info(`Student profile created by parent ${parentId}: ${student._id}`);

      return {
        student: studentResponse,
        temp_password: tempPassword
      };

    } catch (error: any) {
     
      // Log mongoose validation errors
      if (error.name === 'ValidationError') {
        Object.keys(error.errors).forEach(key => {
        });
      }
      
      logger.error('Create student profile failed:', error);
      throw error;
    }
  }

  async getStudentProfilesByParent(parentId: string): Promise<IUserResponse[]> {
    try {
      // 1. Verify parent exists
      const parent = await User.findOne({
        _id: parentId,
        role: UserRole.PARENT,
        status: UserStatus.ACTIVE
      });

      if (!parent) {
        throw new Error('Phụ huynh không tồn tại hoặc chưa được kích hoạt');
      }

      // 2. Get all students of this parent
      const students = await User.find({
        parent_id: parentId,
        role: UserRole.STUDENT,
        status: { $ne: UserStatus.DELETED }
      }).sort({ created_at: -1 });

      // 3. Transform to response format
      const studentsResponse: IUserResponse[] = students.map(student => ({
        id: student._id,
        full_name: student.full_name,
        email: student.email,
        phone_number: student.phone_number,
        avatar_url: student.avatar_url,
        role: student.role,
        status: student.status,
        address: student.address,
        parent_id: student.parent_id,
        date_of_birth: student.date_of_birth,
        gender: student.gender,
        grade: student.grade,
        school: student.school,
        subjects: student.subjects,
        learning_goals: student.learning_goals,
        preferred_schedule: student.preferred_schedule,
        special_requirements: student.special_requirements,
        created_at: student.created_at!,
        updated_at: student.updated_at!,
      }));

      logger.info(`Retrieved ${students.length} student profiles for parent ${parentId}`);

      return studentsResponse;

    } catch (error: any) {
      logger.error('Get student profiles failed:', error);
      throw error;
    }
  }

  async getStudentProfile(studentId: string, parentId: string): Promise<IUserResponse> {
    try {
      // 1. Find student and verify ownership
      const student = await User.findOne({
        _id: studentId,
        parent_id: parentId,
        role: UserRole.STUDENT,
        status: { $ne: UserStatus.DELETED }
      });

      if (!student) {
        throw new Error('Không tìm thấy hồ sơ học viên hoặc bạn không có quyền truy cập');
      }

      // 2. Transform to response format
      const studentResponse: IUserResponse = {
        id: student._id,
        full_name: student.full_name,
        email: student.email,
        phone_number: student.phone_number,
        avatar_url: student.avatar_url,
        role: student.role,
        status: student.status,
        address: student.address,
        parent_id: student.parent_id,
        date_of_birth: student.date_of_birth,
        gender: student.gender,
        grade: student.grade,
        school: student.school,
        subjects: student.subjects,
        learning_goals: student.learning_goals,
        preferred_schedule: student.preferred_schedule,
        special_requirements: student.special_requirements,
        created_at: student.created_at!,
        updated_at: student.updated_at!,
      };

      logger.info(`Retrieved student profile ${studentId} for parent ${parentId}`);

      return studentResponse;

    } catch (error: any) {
      logger.error('Get student profile failed:', error);
      throw error;
    }
  }

  async updateStudentProfile(
    studentId: string, 
    parentId: string, 
    updateData: Partial<IStudentProfileInput>
  ): Promise<IUserResponse> {
    try {
      // 1. Find student and verify ownership
      const student = await User.findOne({
        _id: studentId,
        parent_id: parentId,
        role: UserRole.STUDENT,
        status: { $ne: UserStatus.DELETED }
      });

      if (!student) {
        throw new Error('Không tìm thấy hồ sơ học viên hoặc bạn không có quyền chỉnh sửa');
      }

      // 2. Update student data
      if (updateData.full_name) student.full_name = updateData.full_name;
      if (updateData.date_of_birth) student.date_of_birth = new Date(updateData.date_of_birth);
      if (updateData.gender) student.gender = updateData.gender;
      if (updateData.phone_number) student.phone_number = updateData.phone_number;
      if (updateData.address) student.address = updateData.address;
      if (updateData.grade) student.grade = updateData.grade;
      if (updateData.school) student.school = updateData.school;
      if (updateData.subjects) student.subjects = updateData.subjects;
      if (updateData.learning_goals) student.learning_goals = updateData.learning_goals;
      if (updateData.preferred_schedule) student.preferred_schedule = updateData.preferred_schedule;
      if (updateData.special_requirements) student.special_requirements = updateData.special_requirements;

      student.updated_at = new Date();
      await student.save();

      // 3. Transform to response format
      const studentResponse: IUserResponse = {
        id: student._id,
        full_name: student.full_name,
        email: student.email,
        phone_number: student.phone_number,
        avatar_url: student.avatar_url,
        role: student.role,
        status: student.status,
        address: student.address,
        parent_id: student.parent_id,
        date_of_birth: student.date_of_birth,
        gender: student.gender,
        grade: student.grade,
        school: student.school,
        subjects: student.subjects,
        learning_goals: student.learning_goals,
        preferred_schedule: student.preferred_schedule,
        special_requirements: student.special_requirements,
        created_at: student.created_at!,
        updated_at: student.updated_at!,
      };

      logger.info(`Updated student profile ${studentId} by parent ${parentId}`);

      return studentResponse;

    } catch (error: any) {
      logger.error('Update student profile failed:', error);
      throw error;
    }
  }

  async deleteStudentProfile(studentId: string, parentId: string): Promise<void> {
    try {
      // 1. Find student and verify ownership
      const student = await User.findOne({
        _id: studentId,
        parent_id: parentId,
        role: UserRole.STUDENT,
        status: { $ne: UserStatus.DELETED }
      });

      if (!student) {
        throw new Error('Không tìm thấy hồ sơ học viên hoặc bạn không có quyền xóa');
      }

      // 2. Soft delete - set status to DELETED
      student.status = UserStatus.DELETED;
      student.updated_at = new Date();
      await student.save();

      logger.info(`Deleted student profile ${studentId} by parent ${parentId}`);

    } catch (error: any) {
      logger.error('Delete student profile failed:', error);
      throw error;
    }
  }

  async getStudentStats(parentId: string): Promise<IStudentStatsResponse> {
    try {
      // 1. Verify parent exists
      const parent = await User.findOne({
        _id: parentId,
        role: UserRole.PARENT,
        status: UserStatus.ACTIVE
      });

      if (!parent) {
        throw new Error('Phụ huynh không tồn tại hoặc chưa được kích hoạt');
      }

      // 2. Get all students
      const students = await User.find({
        parent_id: parentId,
        role: UserRole.STUDENT,
        status: { $ne: UserStatus.DELETED }
      });

      // 3. Calculate stats
      const totalStudents = students.length;
      const activeStudents = students.filter(s => s.status === UserStatus.ACTIVE).length;

      // Grade distribution
      const gradeMap = new Map<string, number>();
      students.forEach(student => {
        if (student.grade) {
          gradeMap.set(student.grade, (gradeMap.get(student.grade) || 0) + 1);
        }
      });
      const byGrade = Array.from(gradeMap.entries()).map(([grade, count]) => ({ grade, count }));

      // Subject distribution
      const subjectMap = new Map<string, number>();
      students.forEach(student => {
        if (student.subjects && Array.isArray(student.subjects)) {
          student.subjects.forEach(subject => {
            subjectMap.set(subject, (subjectMap.get(subject) || 0) + 1);
          });
        }
      });
      const bySubject = Array.from(subjectMap.entries()).map(([subject, count]) => ({ subject, count }));

      // Recent students (last 5)
      const recentStudents = students
        .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
        .slice(0, 5)
        .map(student => ({
          id: student._id,
          full_name: student.full_name,
          email: student.email,
          phone_number: student.phone_number,
          avatar_url: student.avatar_url,
          role: student.role,
          status: student.status,
          address: student.address,
          parent_id: student.parent_id,
          date_of_birth: student.date_of_birth,
          gender: student.gender,
          grade: student.grade,
          school: student.school,
          subjects: student.subjects,
          learning_goals: student.learning_goals,
          preferred_schedule: student.preferred_schedule,
          special_requirements: student.special_requirements,
          created_at: student.created_at!,
          updated_at: student.updated_at!,
        }));

      const stats: IStudentStatsResponse = {
        total_students: totalStudents,
        active_students: activeStudents,
        by_grade: byGrade,
        by_subject: bySubject,
        recent_students: recentStudents
      };

      logger.info(`Retrieved student stats for parent ${parentId}`);

      return stats;

    } catch (error: any) {
      logger.error('Get student stats failed:', error);
      throw error;
    }
  }

  async resendStudentPassword(studentId: string, parentId: string): Promise<{ temp_password: string }> {
    try {
      // 1. Find student and verify ownership
      const student = await User.findOne({
        _id: studentId,
        parent_id: parentId,
        role: UserRole.STUDENT,
        status: { $ne: UserStatus.DELETED }
      });

      if (!student) {
        throw new Error('Không tìm thấy hồ sơ học viên hoặc bạn không có quyền thực hiện');
      }

      // 2. Generate new temp password
      const tempPassword = this.generateTempPassword();
      const hashedPassword = await this.hashPassword(tempPassword);

      // 3. Update student password
      // 3. Update student password
      student.password_hash = hashedPassword;
      student.updated_at = new Date();
      await student.save();

      logger.info(`Resent password for student ${studentId} by parent ${parentId}`);

      return {
        temp_password: tempPassword
      };

    } catch (error: any) {
      logger.error('Resend student password failed:', error);
      throw error;
    }
  }
}

export const studentService = new StudentService();