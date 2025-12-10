import SessionReport, {
  ISessionReport,
  IReportEvidence,
  IReporterInfo,
  IReportResolution,
  IAdminNote,
} from '../../models/SessionReport';
import { LearningClass } from '../../models/LearningClass';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { uploadToCloudinaryGeneric } from '../../config/cloudinary';
import { v4 as uuidv4 } from 'uuid';
import {
  notifySessionReportCreated,
  notifySessionReportResolved,
  notifySessionReportUnderReview,
} from '../notification/notification.helpers';

interface CreateReportData {
  classId: string;
  sessionNumber: number;
  description: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface ResolveReportData {
  decision:
    | 'STUDENT_FAULT'
    | 'TUTOR_FAULT'
    | 'BOTH_FAULT'
    | 'NO_FAULT'
    | 'DISMISSED';
  message: string;
}

interface GetReportsFilter {
  status?: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  classId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

class SessionReportService {
  /**
   * Validate that a session can be reported
   * - Session must exist
   * - Session must be completed or within 48 hours after scheduled time
   */
  private async validateReportingWindow(
    classId: string,
    sessionNumber: number
  ): Promise<{ valid: boolean; message: string; session?: any }> {
    const learningClass = await LearningClass.findById(classId);

    if (!learningClass) {
      return { valid: false, message: 'Không tìm thấy lớp học' };
    }

    const session = learningClass.sessions.find(
      (s) => s.sessionNumber === sessionNumber
    );

    if (!session) {
      return { valid: false, message: 'Không tìm thấy buổi học' };
    }

    const now = new Date();
    const sessionEndTime = new Date(
      new Date(session.scheduledDate).getTime() + session.duration * 60000
    );
    const fortyEightHoursAfter = new Date(
      sessionEndTime.getTime() + 48 * 60 * 60 * 1000
    );

    // Can report during the session or within 48 hours after session ends
    const sessionStartTime = new Date(session.scheduledDate);

    if (now < sessionStartTime) {
      return {
        valid: false,
        message: 'Chưa thể báo cáo buổi học chưa diễn ra',
      };
    }

    if (now > fortyEightHoursAfter) {
      return {
        valid: false,
        message: 'Đã quá thời hạn 48 giờ để báo cáo buổi học này',
      };
    }

    return { valid: true, message: 'OK', session };
  }

  /**
   * Check if user has already reported this session
   */
  private async hasAlreadyReported(
    classId: string,
    sessionNumber: number,
    userId: string
  ): Promise<boolean> {
    const existingReport = await SessionReport.findOne({
      classId,
      sessionNumber,
      'reportedBy.userId': userId,
    });

    return !!existingReport;
  }

  /**
   * Upload evidence files to Cloudinary
   */
  private async uploadEvidence(
    files: Express.Multer.File[],
    classId: string
  ): Promise<IReportEvidence[]> {
    const evidenceList: IReportEvidence[] = [];

    for (const file of files) {
      try {
        const folder = `skillbridge/reports/${classId}`;
        const filename = `${uuidv4()}_${file.originalname}`;

        const url = await uploadToCloudinaryGeneric(
          file.buffer,
          folder,
          filename
        );

        let type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' = 'DOCUMENT';
        if (file.mimetype.startsWith('image/')) {
          type = 'IMAGE';
        } else if (file.mimetype.startsWith('video/')) {
          type = 'VIDEO';
        }

        evidenceList.push({
          url,
          type,
          fileName: file.originalname,
          uploadedAt: new Date(),
        });
      } catch (error) {
        logger.error('Error uploading evidence file:', error);
        throw new Error(`Không thể tải lên tệp ${file.originalname}`);
      }
    }

    return evidenceList;
  }

  /**
   * Get the other party's user ID from a class
   */
  private async getOtherPartyUserId(
    classId: string,
    reportedAgainst: 'STUDENT' | 'TUTOR'
  ): Promise<string | null> {
    const learningClass = await LearningClass.findById(classId);
    if (!learningClass) return null;

    if (reportedAgainst === 'STUDENT') {
      return learningClass.studentId.toString();
    } else {
      return learningClass.tutorId.toString();
    }
  }

  /**
   * Create a new session report
   */
  async createReport(
    reportData: CreateReportData,
    reporterId: string,
    reporterRole: 'STUDENT' | 'TUTOR',
    evidenceFiles?: Express.Multer.File[]
  ): Promise<ISessionReport> {
    try {
      // Validate reporting window
      const validation = await this.validateReportingWindow(
        reportData.classId,
        reportData.sessionNumber
      );

      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Check if user has already reported this session
      const alreadyReported = await this.hasAlreadyReported(
        reportData.classId,
        reportData.sessionNumber,
        reporterId
      );

      if (alreadyReported) {
        throw new Error(
          'Bạn đã báo cáo buổi học này rồi. Mỗi bên chỉ được báo cáo 1 lần.'
        );
      }

      // Verify that the reporter is part of the class
      const learningClass = await LearningClass.findById(reportData.classId);
      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      const isStudent = learningClass.studentId.toString() === reporterId;
      const isTutor = learningClass.tutorId.toString() === reporterId;

      if (!isStudent && !isTutor) {
        throw new Error('Bạn không có quyền báo cáo buổi học này');
      }

      // Tự động xác định reportedAgainst dựa trên vai trò người báo cáo
      // Học viên báo cáo về gia sư, gia sư báo cáo về học viên
      const reportedAgainst: 'STUDENT' | 'TUTOR' =
        reporterRole === 'STUDENT' ? 'TUTOR' : 'STUDENT';

      // Get reporter info
      const reporter = await User.findById(reporterId);
      if (!reporter) {
        throw new Error('Không tìm thấy thông tin người báo cáo');
      }

      const reporterInfo: IReporterInfo = {
        userId: reporterId,
        role: reporterRole,
        userName: reporter.full_name,
      };

      // Upload evidence files
      let evidence: IReportEvidence[] = [];
      if (evidenceFiles && evidenceFiles.length > 0) {
        evidence = await this.uploadEvidence(evidenceFiles, reportData.classId);
      }

      // Create report
      const report = new SessionReport({
        classId: reportData.classId,
        sessionNumber: reportData.sessionNumber,
        reportedBy: reporterInfo,
        reportedAgainst: reportedAgainst,
        description: reportData.description,
        evidence,
        priority: reportData.priority || 'MEDIUM',
        status: 'PENDING',
      });

      await report.save();

      logger.info('Session report created:', {
        reportId: report._id,
        classId: reportData.classId,
        sessionNumber: reportData.sessionNumber,
        reportedBy: reporterRole,
      });

      // Notify the other party and admin
      const otherPartyId = await this.getOtherPartyUserId(
        reportData.classId,
        reportedAgainst
      );

      if (otherPartyId) {
        await notifySessionReportCreated(
          otherPartyId,
          reporterInfo.userName,
          reportData.classId,
          reportData.sessionNumber,
          report._id
        );
      }

      // Notify all admins (you may want to implement a specific admin notification)
      // For now, we'll just log it
      logger.info('Admin notification needed for report:', report._id);

      return report;
    } catch (error: any) {
      logger.error('Create session report error:', error);
      throw error;
    }
  }

  /**
   * Get reports for a specific user (student or tutor)
   */
  async getMyReports(
    userId: string,
    userRole: 'STUDENT' | 'TUTOR',
    filters: GetReportsFilter = {}
  ): Promise<{
    reports: ISessionReport[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = {
        'reportedBy.userId': userId,
      };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.priority) {
        query.priority = filters.priority;
      }

      if (filters.classId) {
        query.classId = filters.classId;
      }

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.createdAt.$lte = filters.endDate;
        }
      }

      const [reports, total] = await Promise.all([
        SessionReport.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        SessionReport.countDocuments(query),
      ]);

      return {
        reports,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error('Get my reports error:', error);
      throw error;
    }
  }

  /**
   * Get all reports (Admin only)
   */
  async getAllReports(filters: GetReportsFilter = {}): Promise<{
    reports: ISessionReport[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const query: any = {};

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.priority) {
        query.priority = filters.priority;
      }

      if (filters.classId) {
        query.classId = filters.classId;
      }

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.createdAt.$lte = filters.endDate;
        }
      }

      const [reports, total] = await Promise.all([
        SessionReport.find(query)
          .sort({ priority: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        SessionReport.countDocuments(query),
      ]);

      return {
        reports,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error('Get all reports error:', error);
      throw error;
    }
  }

  /**
   * Get report by ID
   */
  async getReportById(
    reportId: string,
    userId: string,
    userRole: string
  ): Promise<ISessionReport> {
    try {
      const report = await SessionReport.findById(reportId);

      if (!report) {
        throw new Error('Không tìm thấy báo cáo');
      }

      // Authorization check
      if (userRole !== 'ADMIN') {
        // Only the reporter or the reported party can view
        const learningClass = await LearningClass.findById(report.classId);
        if (!learningClass) {
          throw new Error('Không tìm thấy lớp học');
        }

        const isReporter = report.reportedBy.userId === userId;
        const isStudent = learningClass.studentId.toString() === userId;
        const isTutor = learningClass.tutorId.toString() === userId;

        if (!isReporter && !isStudent && !isTutor) {
          throw new Error('Bạn không có quyền xem báo cáo này');
        }
      }

      return report;
    } catch (error: any) {
      logger.error('Get report by ID error:', error);
      throw error;
    }
  }

  /**
   * Update report status (Admin only)
   */
  async updateReportStatus(
    reportId: string,
    status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED',
    adminId: string
  ): Promise<ISessionReport> {
    try {
      const report = await SessionReport.findById(reportId);

      if (!report) {
        throw new Error('Không tìm thấy báo cáo');
      }

      report.status = status;
      await report.save();

      // Send notification if status changed to UNDER_REVIEW
      if (status === 'UNDER_REVIEW') {
        await notifySessionReportUnderReview(
          report.reportedBy.userId,
          report.classId,
          report.sessionNumber,
          report._id
        );
      }

      logger.info('Report status updated:', {
        reportId,
        newStatus: status,
        adminId,
      });

      return report;
    } catch (error: any) {
      logger.error('Update report status error:', error);
      throw error;
    }
  }

  /**
   * Resolve a report (Admin only)
   */
  async resolveReport(
    reportId: string,
    resolutionData: ResolveReportData,
    adminId: string
  ): Promise<ISessionReport> {
    try {
      const report = await SessionReport.findById(reportId);

      if (!report) {
        throw new Error('Không tìm thấy báo cáo');
      }

      if (report.status === 'RESOLVED') {
        throw new Error('Báo cáo này đã được xử lý rồi');
      }

      // Get admin info
      const admin = await User.findById(adminId);
      if (!admin) {
        throw new Error('Không tìm thấy thông tin admin');
      }

      // Create resolution
      const resolution: IReportResolution = {
        resolvedBy: adminId,
        resolverName: admin.full_name,
        decision: resolutionData.decision,
        message: resolutionData.message,
        resolvedAt: new Date(),
      };

      report.resolution = resolution;
      report.status = 'RESOLVED';
      await report.save();

      // Get both parties to notify
      const learningClass = await LearningClass.findById(report.classId);
      if (!learningClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      const studentId = learningClass.studentId.toString();
      const tutorId = learningClass.tutorId.toString();

      // Notify both student and tutor about the resolution
      await Promise.all([
        notifySessionReportResolved(
          studentId,
          report.classId,
          report.sessionNumber,
          report._id,
          resolutionData.decision
        ),
        notifySessionReportResolved(
          tutorId,
          report.classId,
          report.sessionNumber,
          report._id,
          resolutionData.decision
        ),
      ]);

      logger.info('Report resolved:', {
        reportId,
        decision: resolutionData.decision,
        adminId,
      });

      return report;
    } catch (error: any) {
      logger.error('Resolve report error:', error);
      throw error;
    }
  }

  /**
   * Add admin note to a report
   */
  async addAdminNote(
    reportId: string,
    note: string,
    adminId: string
  ): Promise<ISessionReport> {
    try {
      const report = await SessionReport.findById(reportId);

      if (!report) {
        throw new Error('Không tìm thấy báo cáo');
      }

      // Get admin info
      const admin = await User.findById(adminId);
      if (!admin) {
        throw new Error('Không tìm thấy thông tin admin');
      }

      const adminNote: IAdminNote = {
        _id: uuidv4(),
        adminId,
        adminName: admin.full_name,
        note,
        createdAt: new Date(),
      };

      report.adminNotes.push(adminNote);
      await report.save();

      logger.info('Admin note added to report:', {
        reportId,
        adminId,
      });

      return report;
    } catch (error: any) {
      logger.error('Add admin note error:', error);
      throw error;
    }
  }

  /**
   * Upload additional evidence to an existing report
   */
  async uploadAdditionalEvidence(
    reportId: string,
    userId: string,
    evidenceFiles: Express.Multer.File[]
  ): Promise<ISessionReport> {
    try {
      const report = await SessionReport.findById(reportId);

      if (!report) {
        throw new Error('Không tìm thấy báo cáo');
      }

      // Check if user is the reporter
      if (report.reportedBy.userId !== userId) {
        throw new Error('Chỉ người báo cáo mới có thể thêm bằng chứng');
      }

      // Check if report is still pending or under review
      if (report.status === 'RESOLVED' || report.status === 'DISMISSED') {
        throw new Error('Không thể thêm bằng chứng cho báo cáo đã xử lý');
      }

      // Upload new evidence
      const newEvidence = await this.uploadEvidence(
        evidenceFiles,
        report.classId
      );

      // Add to existing evidence
      report.evidence.push(...newEvidence);
      await report.save();

      logger.info('Additional evidence uploaded:', {
        reportId,
        filesCount: newEvidence.length,
      });

      return report;
    } catch (error: any) {
      logger.error('Upload additional evidence error:', error);
      throw error;
    }
  }
}

export const sessionReportService = new SessionReportService();
