import {
  Education,
  Certificate,
  Achievement,
  VerificationRequest,
  VerificationDetail,
  TutorProfile,
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
  static async isTutorQualified(tutorId: string): Promise<boolean> {
    try {
      // Kiểm tra có trình độ học vấn đã xác thực (chỉ cần education, không cần certificate)
      const education = await Education.findOne({
        tutorId,
        status: VerificationStatus.VERIFIED,
      });

      // Chỉ cần education được xác thực là đủ điều kiện
      return !!education;
    } catch (error: any) {
      throw new Error(`Lỗi kiểm tra điều kiện hành nghề: ${error.message}`);
    }
  }

  /**
   * Lấy toàn bộ thông tin trình độ của gia sư
   */
  static async getTutorQualifications(tutorId: string) {
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
    tutorId: string,
    targetType: VerificationTargetType,
    targetId: string
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
        case VerificationTargetType.TUTOR_PROFILE:
          target = await TutorProfile.findOne({
            _id: targetId,
            user_id: tutorId,
          });
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
    tutorId: string,
    data: {
      educationId?: string;
      certificateIds?: string[];
      achievementIds?: string[];
      tutorProfileId?: string;
    }
  ) {
    try {
      // Kiểm tra thông tin cơ bản
      const {
        educationId,
        certificateIds = [],
        achievementIds = [],
        tutorProfileId,
      } = data;

      // Kiểm tra yêu cầu đầu tiên: chỉ cần có education (không cần certificate)
      const isFirstRequest = !(await this.isTutorQualified(tutorId));

      if (isFirstRequest) {
        if (!educationId) {
          throw new Error('Yêu cầu đầu tiên phải có trình độ học vấn');
        }
      }

      // Kiểm tra không có yêu cầu đang pending cho qualifications
      // (Chỉ kiểm tra nếu có educationId, certificateIds, hoặc achievementIds)
      const hasQualificationData =
        educationId || certificateIds.length > 0 || achievementIds.length > 0;

      if (hasQualificationData) {
        const pendingRequest = await VerificationRequest.findOne({
          tutorId,
          status: RequestStatus.PENDING,
        });

        if (pendingRequest) {
          // Kiểm tra xem pending request có chứa qualification data không
          const qualificationDetails = await VerificationDetail.find({
            requestId: pendingRequest._id,
            targetType: {
              $in: [
                VerificationTargetType.EDUCATION,
                VerificationTargetType.CERTIFICATE,
                VerificationTargetType.ACHIEVEMENT,
              ],
            },
          });

          if (qualificationDetails.length > 0) {
            throw new Error('Đã có yêu cầu xác thực trình độ đang chờ xử lý');
          }
        }
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

      // Tutor Profile detail
      if (tutorProfileId) {
        // Kiểm tra không có yêu cầu đang pending cho tutor profile
        const pendingRequest = await VerificationRequest.findOne({
          tutorId,
          status: RequestStatus.PENDING,
        });

        if (pendingRequest) {
          // Kiểm tra xem pending request có chứa tutor profile data không
          const tutorProfileDetail = await VerificationDetail.findOne({
            requestId: pendingRequest._id,
            targetType: VerificationTargetType.TUTOR_PROFILE,
            targetId: tutorProfileId,
          });

          if (tutorProfileDetail) {
            throw new Error(
              'Đã có yêu cầu xác thực thông tin gia sư đang chờ xử lý'
            );
          }
        }

        const tutorProfile = await TutorProfile.findById(tutorProfileId);
        if (!tutorProfile) {
          throw new Error('Không tìm thấy thông tin gia sư');
        }

        if (tutorProfile.user_id !== tutorId) {
          throw new Error('Không có quyền truy cập thông tin này');
        }

        // Chuyển DRAFT sang PENDING trước khi tạo verification request
        if (tutorProfile.status === VerificationStatus.DRAFT) {
          await this.submitDraftForVerification(
            tutorId,
            VerificationTargetType.TUTOR_PROFILE,
            tutorProfileId
          );
          tutorProfile.status = VerificationStatus.PENDING; // Update local object
        }

        const requestType =
          tutorProfile.status === VerificationStatus.VERIFIED
            ? RequestType.UPDATE
            : RequestType.NEW;

        const detail = new VerificationDetail({
          requestId: verificationRequest._id,
          targetType: VerificationTargetType.TUTOR_PROFILE,
          targetId: tutorProfileId,
          requestType,
          dataSnapshot: tutorProfile.toObject(),
        });
        details.push(detail);

        // Cập nhật trạng thái tutor profile
        if (tutorProfile.status === VerificationStatus.VERIFIED) {
          tutorProfile.verified_data = {
            headline: tutorProfile.headline,
            introduction: tutorProfile.introduction,
            teaching_experience: tutorProfile.teaching_experience,
            student_levels: tutorProfile.student_levels,
            video_intro_link: tutorProfile.video_intro_link,
            cccd_images: tutorProfile.cccd_images,
          };
          tutorProfile.status = VerificationStatus.MODIFIED_PENDING;
          await tutorProfile.save();
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
   * 3.2.1. Tạo yêu cầu xác thực chỉ cho TutorProfile
   */
  static async createTutorProfileVerificationRequest(
    tutorId: string,
    tutorProfileId: string
  ) {
    try {
      // Kiểm tra không có yêu cầu đang pending cho tutor profile
      const pendingRequest = await VerificationRequest.findOne({
        tutorId,
        status: RequestStatus.PENDING,
      });

      if (pendingRequest) {
        // Kiểm tra xem pending request có chứa tutor profile data không
        const tutorProfileDetail = await VerificationDetail.findOne({
          requestId: pendingRequest._id,
          targetType: VerificationTargetType.TUTOR_PROFILE,
          targetId: tutorProfileId,
        });

        if (tutorProfileDetail) {
          throw new Error(
            'Đã có yêu cầu xác thực thông tin gia sư đang chờ xử lý'
          );
        }
      }

      const tutorProfile = await TutorProfile.findById(tutorProfileId);
      if (!tutorProfile) {
        throw new Error('Không tìm thấy thông tin gia sư');
      }

      if (tutorProfile.user_id !== tutorId) {
        throw new Error('Không có quyền truy cập thông tin này');
      }

      // Tạo verification request
      const verificationRequest = new VerificationRequest({
        tutorId,
        status: RequestStatus.PENDING,
        submittedAt: new Date(),
      });

      await verificationRequest.save();

      // Chuyển DRAFT sang PENDING trước khi tạo verification request
      if (tutorProfile.status === VerificationStatus.DRAFT) {
        await this.submitDraftForVerification(
          tutorId,
          VerificationTargetType.TUTOR_PROFILE,
          tutorProfileId
        );
        tutorProfile.status = VerificationStatus.PENDING; // Update local object
      }

      const requestType =
        tutorProfile.status === VerificationStatus.VERIFIED
          ? RequestType.UPDATE
          : RequestType.NEW;

      const detail = new VerificationDetail({
        requestId: verificationRequest._id,
        targetType: VerificationTargetType.TUTOR_PROFILE,
        targetId: tutorProfileId,
        requestType,
        dataSnapshot: tutorProfile.toObject(),
      });

      await detail.save();

      // Cập nhật trạng thái tutor profile
      if (tutorProfile.status === VerificationStatus.VERIFIED) {
        tutorProfile.verified_data = {
          headline: tutorProfile.headline,
          introduction: tutorProfile.introduction,
          teaching_experience: tutorProfile.teaching_experience,
          student_levels: tutorProfile.student_levels,
          video_intro_link: tutorProfile.video_intro_link,
          cccd_images: tutorProfile.cccd_images,
        };
        tutorProfile.status = VerificationStatus.MODIFIED_PENDING;
        await tutorProfile.save();
      }

      return verificationRequest;
    } catch (error: any) {
      throw new Error(
        `Lỗi tạo yêu cầu xác thực thông tin gia sư: ${error.message}`
      );
    }
  }

  /**
   * 3.2.2. Lấy trạng thái xác thực của TutorProfile
   */
  static async getTutorProfileVerificationStatus(tutorId: string) {
    try {
      const tutorProfile = await TutorProfile.findOne({ user_id: tutorId });

      if (!tutorProfile) {
        return {
          status: VerificationStatus.DRAFT,
          canSubmit: true,
          pendingChanges: false,
          rejectionReason: null,
        };
      }

      // Kiểm tra có yêu cầu xác thực đang chờ cho tutor profile không
      const pendingRequest = await VerificationRequest.findOne({
        tutorId,
        status: {
          $in: [RequestStatus.PENDING, RequestStatus.PARTIALLY_APPROVED],
        },
      });

      let canSubmit = true;
      if (pendingRequest) {
        const tutorProfileDetail = await VerificationDetail.findOne({
          requestId: pendingRequest._id,
          targetType: VerificationTargetType.TUTOR_PROFILE,
          targetId: tutorProfile._id,
        });

        if (tutorProfileDetail) {
          canSubmit = false; // Có yêu cầu xác thực đang chờ cho tutor profile
        }
      }

      const pendingChanges =
        tutorProfile.status !== VerificationStatus.VERIFIED;

      return {
        status: tutorProfile.status,
        canSubmit,
        pendingChanges,
        rejectionReason: tutorProfile.rejection_reason,
        verifiedAt: tutorProfile.verified_at,
        verifiedBy: tutorProfile.verified_by,
      };
    } catch (error: any) {
      throw new Error(`Lỗi lấy trạng thái xác thực: ${error.message}`);
    }
  }

  /**
   * 3.2.3. Kiểm tra có thể chỉnh sửa thông tin đã được xác thực không
   */
  static async canEditVerifiedInfo(
    tutorId: string,
    targetType: VerificationTargetType,
    targetId: string
  ): Promise<{ canEdit: boolean; message?: string; warning?: string }> {
    try {
      let currentStatus: VerificationStatus | undefined;
      let targetName: string;

      switch (targetType) {
        case VerificationTargetType.EDUCATION:
          const education = await Education.findById(targetId);
          currentStatus = education?.status;
          targetName = 'trình độ học vấn';
          break;
        case VerificationTargetType.CERTIFICATE:
          const certificate = await Certificate.findById(targetId);
          currentStatus = certificate?.status;
          targetName = 'chứng chỉ';
          break;
        case VerificationTargetType.ACHIEVEMENT:
          const achievement = await Achievement.findById(targetId);
          currentStatus = achievement?.status;
          targetName = 'thành tích';
          break;
        case VerificationTargetType.TUTOR_PROFILE:
          const tutorProfile = await TutorProfile.findById(targetId);
          currentStatus = tutorProfile?.status;
          targetName = 'thông tin gia sư';
          break;
        default:
          return { canEdit: false, message: 'Loại thông tin không hợp lệ' };
      }

      if (!currentStatus) {
        return { canEdit: false, message: `Không tìm thấy ${targetName}` };
      }

      // Không cho phép sửa khi đang pending hoặc modified pending
      if (currentStatus === VerificationStatus.PENDING) {
        return {
          canEdit: false,
          message: `${targetName} đang chờ xác thực, không thể chỉnh sửa`,
        };
      }

      if (currentStatus === VerificationStatus.MODIFIED_PENDING) {
        return {
          canEdit: false,
          message: `${targetName} đang chờ duyệt chỉnh sửa, không thể chỉnh sửa thêm`,
        };
      }

      // Cảnh báo khi sửa thông tin đã được xác thực
      if (currentStatus === VerificationStatus.VERIFIED) {
        return {
          canEdit: true,
          warning: `Thông tin ${targetName} đã được xác thực. Mọi thay đổi sẽ cần gửi yêu cầu xác thực cho admin.`,
        };
      }

      // Cho phép sửa trong các trường hợp khác
      return { canEdit: true };
    } catch (error: any) {
      throw new Error(`Lỗi kiểm tra quyền chỉnh sửa: ${error.message}`);
    }
  }

  /**
   * 3.2.4. Kiểm tra trạng thái TutorProfile có thể chỉnh sửa không
   */
  static async canEditTutorProfile(tutorId: string): Promise<{
    canEdit: boolean;
    message?: string;
    warning?: string;
    status?: VerificationStatus;
  }> {
    try {
      const tutorProfile = await TutorProfile.findOne({ user_id: tutorId });

      if (!tutorProfile) {
        return {
          canEdit: true,
          message: 'Chưa có thông tin gia sư, có thể tạo mới',
        };
      }

      const result = await this.canEditVerifiedInfo(
        tutorId,
        VerificationTargetType.TUTOR_PROFILE,
        tutorProfile._id
      );

      return {
        ...result,
        status: tutorProfile.status,
      };
    } catch (error: any) {
      throw new Error(
        `Lỗi kiểm tra quyền chỉnh sửa thông tin gia sư: ${error.message}`
      );
    }
  }

  /**
   * 3.3. Kiểm tra có thể sửa đổi thông tin không
   */
  static async canModifyInfo(
    tutorId: string,
    targetType: VerificationTargetType,
    targetId: string
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
        case VerificationTargetType.TUTOR_PROFILE:
          const tutorProfile = await TutorProfile.findById(targetId);
          currentStatus = tutorProfile?.status;
          break;
        default:
          return false;
      }

      // Nếu không tìm thấy object hoặc không có status thì không cho phép sửa
      if (!currentStatus) {
        return false;
      }

      // Cho phép sửa nếu là DRAFT, REJECTED, VERIFIED, hoặc MODIFIED_AFTER_REJECTION
      // Không cho phép sửa nếu đang chờ xác thực
      return (
        currentStatus === VerificationStatus.DRAFT ||
        currentStatus === VerificationStatus.REJECTED ||
        currentStatus === VerificationStatus.VERIFIED ||
        currentStatus === VerificationStatus.MODIFIED_AFTER_REJECTION
      );
    } catch (error: any) {
      throw new Error(`Lỗi kiểm tra quyền sửa đổi: ${error.message}`);
    }
  }

  /**
   * 3.4. Kiểm tra có thể xóa chứng chỉ không
   */
  static async canDeleteCertificate(
    tutorId: string,
    certificateId: string
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
    targetId: string
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

        case VerificationTargetType.TUTOR_PROFILE:
          const tutorProfile = await TutorProfile.findById(targetId);
          if (tutorProfile?.verified_data) {
            const verifiedData = tutorProfile.verified_data;
            tutorProfile.headline = verifiedData.headline;
            tutorProfile.introduction = verifiedData.introduction;
            tutorProfile.teaching_experience = verifiedData.teaching_experience;
            tutorProfile.student_levels = verifiedData.student_levels;
            tutorProfile.video_intro_link = verifiedData.video_intro_link;
            tutorProfile.cccd_images = verifiedData.cccd_images;
            tutorProfile.status = VerificationStatus.VERIFIED;
            tutorProfile.verified_data = undefined;
            tutorProfile.rejection_reason = undefined;
            await tutorProfile.save();
          }
          break;
      }
    } catch (error: any) {
      throw new Error(`Lỗi khôi phục dữ liệu đã xác thực: ${error.message}`);
    }
  }
}
