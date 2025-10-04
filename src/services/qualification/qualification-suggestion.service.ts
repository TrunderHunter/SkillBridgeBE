import {
  Education,
  Certificate,
  Achievement,
  VerificationRequest,
} from '../../models';
import { VerificationStatus } from '../../types/verification.types';

export interface QualificationSuggestion {
  isQualified: boolean;
  canSubmitVerification: boolean;
  hasChangesNeedVerification: boolean;
  pendingVerificationCount: number;
  missingRequirements: string[];
  suggestion: string;
}

export class QualificationSuggestionService {
  /**
   * Kiểm tra trạng thái qualification và tạo gợi ý cho user
   */
  static async getQualificationSuggestion(
    tutorId: string
  ): Promise<QualificationSuggestion> {
    // Lấy tất cả thông tin qualification
    const [education, certificates, achievements, pendingRequest] =
      await Promise.all([
        Education.findOne({ tutorId }),
        Certificate.find({ tutorId }),
        Achievement.find({ tutorId }),
        VerificationRequest.findOne({
          tutorId,
          status: { $in: ['PENDING', 'PARTIALLY_APPROVED'] },
        }),
      ]);

    // Kiểm tra điều kiện cơ bản
    const hasEducation = !!education;
    const hasVerifiedEducation =
      education?.status === VerificationStatus.VERIFIED;
    const verifiedCertificates = certificates.filter(
      (cert) => cert.status === VerificationStatus.VERIFIED
    );
    const hasVerifiedCertificate = verifiedCertificates.length > 0;

    // Kiểm tra đủ điều kiện hành nghề - chỉ cần education được xác thực
    const isQualified = hasVerifiedEducation;

    // Kiểm tra có thông tin cần xác thực (DRAFT và PENDING)
    const pendingEducation = education?.status === VerificationStatus.PENDING;
    const draftEducation = education?.status === VerificationStatus.DRAFT;
    const modifiedEducation =
      education?.status === VerificationStatus.MODIFIED_PENDING ||
      education?.status === VerificationStatus.MODIFIED_AFTER_REJECTION;

    const pendingCertificates = certificates.filter(
      (cert) =>
        cert.status === VerificationStatus.PENDING ||
        cert.status === VerificationStatus.MODIFIED_PENDING ||
        cert.status === VerificationStatus.MODIFIED_AFTER_REJECTION
    );
    const draftCertificates = certificates.filter(
      (cert) => cert.status === VerificationStatus.DRAFT
    );

    const pendingAchievements = achievements.filter(
      (ach) =>
        ach.status === VerificationStatus.PENDING ||
        ach.status === VerificationStatus.MODIFIED_PENDING ||
        ach.status === VerificationStatus.MODIFIED_AFTER_REJECTION
    );
    const draftAchievements = achievements.filter(
      (ach) => ach.status === VerificationStatus.DRAFT
    );

    const totalPendingCount =
      (pendingEducation || modifiedEducation ? 1 : 0) +
      pendingCertificates.length +
      pendingAchievements.length;

    const totalDraftCount =
      (draftEducation ? 1 : 0) +
      draftCertificates.length +
      draftAchievements.length;

    const hasChangesNeedVerification = totalPendingCount > 0;
    const hasDraftItems = totalDraftCount > 0;
    const canSubmitVerification =
      (hasChangesNeedVerification || hasDraftItems) && !pendingRequest;

    // Xác định yêu cầu còn thiếu
    const missingRequirements: string[] = [];
    if (!hasEducation) missingRequirements.push('education');
    if (certificates.length === 0) missingRequirements.push('certificate');

    // Tạo gợi ý phù hợp
    const suggestion = this.generateSuggestion({
      isQualified,
      canSubmitVerification,
      hasChangesNeedVerification,
      hasDraftItems,
      pendingVerificationCount: totalPendingCount + totalDraftCount,
      missingRequirements,
      hasPendingRequest: !!pendingRequest,
    });

    return {
      isQualified,
      canSubmitVerification,
      hasChangesNeedVerification: hasChangesNeedVerification || hasDraftItems,
      pendingVerificationCount: totalPendingCount + totalDraftCount,
      missingRequirements,
      suggestion,
    };
  }

  /**
   * Tạo gợi ý dựa trên trạng thái hiện tại
   */
  private static generateSuggestion(params: {
    isQualified: boolean;
    canSubmitVerification: boolean;
    hasChangesNeedVerification: boolean;
    hasDraftItems: boolean;
    pendingVerificationCount: number;
    missingRequirements: string[];
    hasPendingRequest: boolean;
  }): string {
    const {
      isQualified,
      canSubmitVerification,
      hasChangesNeedVerification,
      hasDraftItems,
      pendingVerificationCount,
      missingRequirements,
      hasPendingRequest,
    } = params;

    // Nếu đã có yêu cầu đang xử lý
    if (hasPendingRequest) {
      return 'Bạn có yêu cầu xác thực đang được xử lý. Vui lòng chờ admin phản hồi.';
    }

    // Nếu chưa đủ điều kiện cơ bản
    if (missingRequirements.length > 0) {
      const missing = missingRequirements
        .map((req) => {
          if (req === 'education') return 'thông tin học vấn';
          if (req === 'certificate') return 'ít nhất 1 chứng chỉ';
          return req;
        })
        .join(' và ');
      return `Bạn cần thêm ${missing} để có thể gửi yêu cầu xác thực.`;
    }

    // Nếu có bản nháp chưa gửi
    if (hasDraftItems && !hasChangesNeedVerification) {
      return `Bạn có ${pendingVerificationCount} thông tin đang ở trạng thái bản nháp. Hãy gửi yêu cầu xác thực để trở thành gia sư chính thức!`;
    }

    // Nếu có thể gửi yêu cầu xác thực
    if (canSubmitVerification) {
      if (!isQualified) {
        return `Bạn đã đủ điều kiện gửi yêu cầu xác thực. Hãy gửi ngay để trở thành gia sư chính thức!`;
      } else {
        return `Bạn có ${pendingVerificationCount} thông tin đã thay đổi cần xác thực. Gửi yêu cầu để duy trì trạng thái gia sư.`;
      }
    }

    // Nếu đã đủ điều kiện và không có thay đổi
    if (isQualified && !hasChangesNeedVerification && !hasDraftItems) {
      return 'Bạn đã đủ điều kiện hành nghề. Tất cả thông tin đã được xác thực.';
    }

    // Trường hợp mặc định
    return 'Hãy cập nhật thông tin hành nghề để trở thành gia sư chính thức.';
  }

  /**
   * Kiểm tra xem có nên hiển thị gợi ý gửi yêu cầu xác thực không
   */
  static async shouldShowVerificationSuggestion(
    tutorId: string
  ): Promise<boolean> {
    const suggestion = await this.getQualificationSuggestion(tutorId);
    return suggestion.canSubmitVerification;
  }
}
