import { Types } from 'mongoose';
import {
  Education,
  Certificate,
  Achievement,
  VerificationRequest,
  VerificationDetail,
} from '../../models';
import {
  VerificationStatus,
  RequestStatus,
  RequestType,
  EducationLevel,
  AchievementLevel,
  AchievementType,
} from '../../types/verification.types';
import { VerificationTargetType } from '../../models/VerificationDetail';

export class QualificationService {
  /**
   * 3.1. Kiểm tra tình trạng đủ điều kiện hành nghề
   */
  static async isTutorQualified(tutorId: Types.ObjectId): Promise<boolean> {
    try {
      // Kiểm tra có trình độ học vấn đã xác thực
      const education = await Education.findOne({
        tutorId,
        status: VerificationStatus.VERIFIED,
      });

      // Kiểm tra có ít nhất một chứng chỉ đã xác thực
      const verifiedCertificate = await Certificate.findOne({
        tutorId,
        status: VerificationStatus.VERIFIED,
      });

      return !!(education && verifiedCertificate);
    } catch (error: any) {
      throw new Error(`Lỗi kiểm tra điều kiện hành nghề: ${error.message}`);
    }
  }

  /**
   * Lấy toàn bộ thông tin trình độ của gia sư
   */
  static async getTutorQualifications(tutorId: Types.ObjectId) {
    try {
      const [education, certificates, achievements] = await Promise.all([
        Education.findOne({ tutorId }),
        Certificate.find({ tutorId }).sort({ createdAt: -1 }),
        Achievement.find({ tutorId }).sort({ createdAt: -1 }),
      ]);

      const isQualified = await this.isTutorQualified(tutorId);

      return {
        education,
        certificates,
        achievements,
        isQualified,
      };
    } catch (error: any) {
      throw new Error(`Lỗi lấy thông tin trình độ: ${error.message}`);
    }
  }

  /**
   * Chuyển trạng thái từ DRAFT sang PENDING khi gửi yêu cầu xác thực
   */
  static async submitDraftForVerification(
    tutorId: Types.ObjectId,
    targetType: VerificationTargetType,
    targetId: Types.ObjectId
  ): Promise<void> {
    try {
      let target: any;

      switch (targetType) {
        case VerificationTargetType.EDUCATION:
          target = await Education.findOne({ _id: targetId, tutorId });
          break;
        case VerificationTargetType.CERTIFICATE:
          target = await Certificate.findOne({ _id: targetId, tutorId });
          break;
        case VerificationTargetType.ACHIEVEMENT:
          target = await Achievement.findOne({ _id: targetId, tutorId });
          break;
        default:
          throw new Error('Loại target không hợp lệ');
      }

      if (!target) {
        throw new Error('Không tìm thấy thông tin cần xác thực');
      }

      if (target.status !== VerificationStatus.DRAFT) {
        throw new Error('Chỉ có thể gửi thông tin ở trạng thái bản nháp');
      }

      target.status = VerificationStatus.PENDING;
      await target.save();
    } catch (error: any) {
      throw new Error(`Lỗi gửi bản nháp để xác thực: ${error.message}`);
    }
  }

  /**
   * 3.2. Tạo yêu cầu xác thực
   */
  static async createVerificationRequest(
    tutorId: Types.ObjectId,
    data: {
      educationId?: Types.ObjectId;
      certificateIds?: Types.ObjectId[];
      achievementIds?: Types.ObjectId[];
    }
  ) {
    try {
      // Kiểm tra thông tin cơ bản
      const { educationId, certificateIds = [], achievementIds = [] } = data;

      // Kiểm tra yêu cầu đầu tiên: phải có education và ít nhất 1 certificate
      const isFirstRequest = !(await this.isTutorQualified(tutorId));

      if (isFirstRequest) {
        if (!educationId || certificateIds.length === 0) {
          throw new Error(
            'Yêu cầu đầu tiên phải có trình độ học vấn và ít nhất một chứng chỉ'
          );
        }
      }

      // Kiểm tra không có yêu cầu đang pending
      const pendingRequest = await VerificationRequest.findOne({
        tutorId,
        status: RequestStatus.PENDING,
      });

      if (pendingRequest) {
        throw new Error('Đã có yêu cầu xác thực đang chờ xử lý');
      }

      // Tạo verification request
      const verificationRequest = new VerificationRequest({
        tutorId,
        status: RequestStatus.PENDING,
      });
      await verificationRequest.save();

      // Tạo verification details
      const details = [];

      // Education detail
      if (educationId) {
        const education = await Education.findById(educationId);
        if (!education) {
          throw new Error('Không tìm thấy thông tin học vấn');
        }

        // Chuyển DRAFT sang PENDING trước khi tạo verification request
        if (education.status === VerificationStatus.DRAFT) {
          await this.submitDraftForVerification(
            tutorId,
            VerificationTargetType.EDUCATION,
            educationId
          );
          education.status = VerificationStatus.PENDING; // Update local object
        }

        const requestType =
          education.status === VerificationStatus.VERIFIED
            ? RequestType.UPDATE
            : RequestType.NEW;

        const detail = new VerificationDetail({
          requestId: verificationRequest._id,
          targetType: VerificationTargetType.EDUCATION,
          targetId: educationId,
          requestType,
          dataSnapshot: education.toObject(),
        });
        details.push(detail);

        // Cập nhật trạng thái education
        if (education.status === VerificationStatus.VERIFIED) {
          education.verifiedData = {
            level: education.level,
            school: education.school,
            major: education.major,
            startYear: education.startYear,
            endYear: education.endYear,
          };
          education.status = VerificationStatus.MODIFIED_PENDING;
          await education.save();
        }
      }

      // Certificate details
      for (const certId of certificateIds) {
        const certificate = await Certificate.findById(certId);
        if (!certificate) {
          continue; // Skip invalid IDs
        }

        // Chuyển DRAFT sang PENDING trước khi tạo verification request
        if (certificate.status === VerificationStatus.DRAFT) {
          await this.submitDraftForVerification(
            tutorId,
            VerificationTargetType.CERTIFICATE,
            certId
          );
          certificate.status = VerificationStatus.PENDING; // Update local object
        }

        const requestType =
          certificate.status === VerificationStatus.VERIFIED
            ? RequestType.UPDATE
            : RequestType.NEW;

        const detail = new VerificationDetail({
          requestId: verificationRequest._id,
          targetType: VerificationTargetType.CERTIFICATE,
          targetId: certId,
          requestType,
          dataSnapshot: certificate.toObject(),
        });
        details.push(detail);

        // Cập nhật trạng thái certificate
        if (certificate.status === VerificationStatus.VERIFIED) {
          certificate.verifiedData = {
            name: certificate.name,
            issuingOrganization: certificate.issuingOrganization,
            description: certificate.description,
            issueDate: certificate.issueDate,
            expiryDate: certificate.expiryDate,
            imageUrl: certificate.imageUrl,
          };
          certificate.status = VerificationStatus.MODIFIED_PENDING;
          await certificate.save();
        }
      }

      // Achievement details
      for (const achievementId of achievementIds) {
        const achievement = await Achievement.findById(achievementId);
        if (!achievement) {
          continue; // Skip invalid IDs
        }

        // Chuyển DRAFT sang PENDING trước khi tạo verification request
        if (achievement.status === VerificationStatus.DRAFT) {
          await this.submitDraftForVerification(
            tutorId,
            VerificationTargetType.ACHIEVEMENT,
            achievementId
          );
          achievement.status = VerificationStatus.PENDING; // Update local object
        }

        const requestType =
          achievement.status === VerificationStatus.VERIFIED
            ? RequestType.UPDATE
            : RequestType.NEW;

        const detail = new VerificationDetail({
          requestId: verificationRequest._id,
          targetType: VerificationTargetType.ACHIEVEMENT,
          targetId: achievementId,
          requestType,
          dataSnapshot: achievement.toObject(),
        });
        details.push(detail);

        // Cập nhật trạng thái achievement
        if (achievement.status === VerificationStatus.VERIFIED) {
          achievement.verifiedData = {
            name: achievement.name,
            level: achievement.level,
            achievedDate: achievement.achievedDate,
            awardingOrganization: achievement.awardingOrganization,
            type: achievement.type,
            field: achievement.field,
            description: achievement.description,
          };
          achievement.status = VerificationStatus.MODIFIED_PENDING;
          await achievement.save();
        }
      }

      // Lưu tất cả verification details
      await VerificationDetail.insertMany(details);

      return verificationRequest;
    } catch (error: any) {
      throw new Error(`Lỗi tạo yêu cầu xác thực: ${error.message}`);
    }
  }

  /**
   * 3.3. Kiểm tra có thể sửa đổi thông tin không
   */
  static async canModifyInfo(
    tutorId: Types.ObjectId,
    targetType: VerificationTargetType,
    targetId: Types.ObjectId
  ): Promise<boolean> {
    try {
      let currentStatus: VerificationStatus | undefined;

      switch (targetType) {
        case VerificationTargetType.EDUCATION:
          const education = await Education.findById(targetId);
          currentStatus = education?.status;
          break;
        case VerificationTargetType.CERTIFICATE:
          const certificate = await Certificate.findById(targetId);
          currentStatus = certificate?.status;
          break;
        case VerificationTargetType.ACHIEVEMENT:
          const achievement = await Achievement.findById(targetId);
          currentStatus = achievement?.status;
          break;
        default:
          return false;
      }

      // Nếu không tìm thấy object hoặc không có status thì không cho phép sửa
      if (!currentStatus) {
        return false;
      }

      // Cho phép sửa nếu là DRAFT, REJECTED, hoặc VERIFIED
      // Không cho phép sửa nếu đang chờ xác thực
      return (
        currentStatus === VerificationStatus.DRAFT ||
        currentStatus === VerificationStatus.REJECTED ||
        currentStatus === VerificationStatus.VERIFIED
      );
    } catch (error: any) {
      throw new Error(`Lỗi kiểm tra quyền sửa đổi: ${error.message}`);
    }
  }

  /**
   * 3.4. Kiểm tra có thể xóa chứng chỉ không
   */
  static async canDeleteCertificate(
    tutorId: Types.ObjectId,
    certificateId: Types.ObjectId
  ): Promise<{ canDelete: boolean; message?: string }> {
    try {
      // Lấy chứng chỉ cần xóa
      const certificate = await Certificate.findById(certificateId);

      // Nếu chứng chỉ chưa được xác thực thì cho phép xóa
      if (certificate && certificate.status == VerificationStatus.DRAFT) {
        return { canDelete: true };
      }

      // Đếm số chứng chỉ đã xác thực (ngoại trừ chứng chỉ này)
      const verifiedCertificatesCount = await Certificate.countDocuments({
        tutorId,
        _id: { $ne: certificateId },
        status: VerificationStatus.VERIFIED,
      });

      if (verifiedCertificatesCount === 0) {
        return {
          canDelete: false,
          message:
            'Không thể xóa chứng chỉ này vì phải có ít nhất một chứng chỉ đã được xác thực',
        };
      }

      return { canDelete: true };
    } catch (error: any) {
      throw new Error(`Lỗi kiểm tra quyền xóa chứng chỉ: ${error.message}`);
    }
  }

  /**
   * Khôi phục thông tin đã xác thực khi bị từ chối
   */
  static async restoreVerifiedData(
    targetType: VerificationTargetType,
    targetId: Types.ObjectId
  ) {
    try {
      switch (targetType) {
        case VerificationTargetType.EDUCATION:
          const education = await Education.findById(targetId);
          if (education?.verifiedData) {
            Object.assign(education, education.verifiedData);
            education.status = VerificationStatus.VERIFIED;
            education.verifiedData = undefined;
            await education.save();
          }
          break;

        case VerificationTargetType.CERTIFICATE:
          const certificate = await Certificate.findById(targetId);
          if (certificate?.verifiedData) {
            Object.assign(certificate, certificate.verifiedData);
            certificate.status = VerificationStatus.VERIFIED;
            certificate.verifiedData = undefined;
            await certificate.save();
          }
          break;

        case VerificationTargetType.ACHIEVEMENT:
          const achievement = await Achievement.findById(targetId);
          if (achievement?.verifiedData) {
            Object.assign(achievement, achievement.verifiedData);
            achievement.status = VerificationStatus.VERIFIED;
            achievement.verifiedData = undefined;
            await achievement.save();
          }
          break;
      }
    } catch (error: any) {
      throw new Error(`Lỗi khôi phục dữ liệu đã xác thực: ${error.message}`);
    }
  }
}
