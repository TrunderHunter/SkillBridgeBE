import {
  VerificationRequest,
  IVerificationRequestDocument,
  VerificationStatus,
} from '../../models/VerificationRequest';
import { Education, IEducationDocument } from '../../models/Education';
import { Certificate, ICertificateDocument } from '../../models/Certificate';
import { Achievement, IAchievementDocument } from '../../models/Achievement';
import { ApiError } from '../../utils/response';

export interface CreateVerificationRequestData {
  tutor_id: string;
  education_id?: string;
  certificate_ids: string[];
  achievement_ids: string[];
}

export class VerificationService {
  /**
   * Create verification request with references to existing documents
   */
  static async createVerificationRequest(
    data: CreateVerificationRequestData
  ): Promise<IVerificationRequestDocument> {
    try {
      // Check if tutor has pending verification request
      const existingRequest = await VerificationRequest.findOne({
        tutor_id: data.tutor_id,
        status: VerificationStatus.PENDING,
      });

      if (existingRequest) {
        throw new ApiError(400, 'Bạn đã có yêu cầu xác thực đang chờ xử lý');
      }

      // Validate minimum requirements
      if (!data.education_id && data.certificate_ids.length === 0) {
        throw new ApiError(
          400,
          'Cần có ít nhất thông tin học vấn hoặc chứng chỉ để yêu cầu xác thực'
        );
      }

      // Verify that referenced documents exist and belong to the tutor
      if (data.education_id) {
        const education = await Education.findOne({
          _id: data.education_id,
          tutor_id: data.tutor_id,
        });
        if (!education) {
          throw new ApiError(400, 'Thông tin học vấn không hợp lệ');
        }
      }

      if (data.certificate_ids.length > 0) {
        const certificates = await Certificate.find({
          _id: { $in: data.certificate_ids },
          tutor_id: data.tutor_id,
        });
        if (certificates.length !== data.certificate_ids.length) {
          throw new ApiError(400, 'Một số chứng chỉ không hợp lệ');
        }
      }

      if (data.achievement_ids.length > 0) {
        const achievements = await Achievement.find({
          _id: { $in: data.achievement_ids },
          tutor_id: data.tutor_id,
        });
        if (achievements.length !== data.achievement_ids.length) {
          throw new ApiError(400, 'Một số thành tích không hợp lệ');
        }
      }

      // Create verification request
      const verificationRequest = new VerificationRequest({
        tutor_id: data.tutor_id,
        education_id: data.education_id || null,
        certificate_ids: data.certificate_ids || [],
        achievement_ids: data.achievement_ids || [],
        status: VerificationStatus.PENDING,
      });

      return await verificationRequest.save();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current verification status for tutor with populated data
   */
  static async getVerificationStatus(
    tutorId: string
  ): Promise<IVerificationRequestDocument | null> {
    return await VerificationRequest.findOne({ tutor_id: tutorId })
      .sort({ created_at: -1 })
      .populate('education_id')
      .populate('certificate_ids')
      .populate('achievement_ids')
      .populate('reviewed_by', 'full_name email');
  }

  /**
   * Get verification history for tutor
   */
  static async getVerificationHistory(
    tutorId: string
  ): Promise<IVerificationRequestDocument[]> {
    return await VerificationRequest.find({ tutor_id: tutorId })
      .sort({ created_at: -1 })
      .populate('education_id')
      .populate('certificate_ids')
      .populate('achievement_ids')
      .populate('reviewed_by', 'full_name email');
  }

  /**
   * Get all pending verification requests (for admin)
   */
  static async getPendingVerificationRequests(): Promise<
    IVerificationRequestDocument[]
  > {
    return await VerificationRequest.find({
      status: VerificationStatus.PENDING,
    })
      .sort({ created_at: 1 })
      .populate('tutor_id', 'full_name email')
      .populate('education_id')
      .populate('certificate_ids')
      .populate('achievement_ids');
  }

  /**
   * Approve verification request
   */
  static async approveVerificationRequest(
    requestId: string,
    adminId: string,
    feedback?: string
  ): Promise<IVerificationRequestDocument> {
    const request = await VerificationRequest.findById(requestId);
    if (!request) {
      throw new ApiError(404, 'Không tìm thấy yêu cầu xác thực');
    }

    if (request.status !== VerificationStatus.PENDING) {
      throw new ApiError(400, 'Yêu cầu xác thực đã được xử lý');
    }

    request.status = VerificationStatus.APPROVED;
    request.reviewed_by = adminId;
    request.reviewed_at = new Date();
    if (feedback) {
      request.admin_feedback = feedback;
    }

    await request.save();

    // Update is_verified status for related records
    const tutorId = request.tutor_id;

    // Update Education is_verified status
    if (request.education_id) {
      await Education.findByIdAndUpdate(request.education_id, {
        is_verified: true,
      });
    }

    // Update Certificates is_verified status
    if (request.certificate_ids && request.certificate_ids.length > 0) {
      await Certificate.updateMany(
        { _id: { $in: request.certificate_ids } },
        { is_verified: true }
      );
    }

    // Update Achievements is_verified status
    if (request.achievement_ids && request.achievement_ids.length > 0) {
      await Achievement.updateMany(
        { _id: { $in: request.achievement_ids } },
        { is_verified: true }
      );
    }

    return request;
  }

  /**
   * Reject verification request
   */
  static async rejectVerificationRequest(
    requestId: string,
    adminId: string,
    feedback: string
  ): Promise<IVerificationRequestDocument> {
    const request = await VerificationRequest.findById(requestId);
    if (!request) {
      throw new ApiError(404, 'Không tìm thấy yêu cầu xác thực');
    }

    if (request.status !== VerificationStatus.PENDING) {
      throw new ApiError(400, 'Yêu cầu xác thực đã được xử lý');
    }

    request.status = VerificationStatus.REJECTED;
    request.reviewed_by = adminId;
    request.reviewed_at = new Date();
    request.admin_feedback = feedback;

    await request.save();

    // Update is_verified status for related records to false when rejected
    const tutorId = request.tutor_id;

    // Update Education is_verified status to false
    if (request.education_id) {
      await Education.findByIdAndUpdate(request.education_id, {
        is_verified: false,
      });
    }

    // Update Certificates is_verified status to false
    if (request.certificate_ids && request.certificate_ids.length > 0) {
      await Certificate.updateMany(
        { _id: { $in: request.certificate_ids } },
        { is_verified: false }
      );
    }

    // Update Achievements is_verified status to false
    if (request.achievement_ids && request.achievement_ids.length > 0) {
      await Achievement.updateMany(
        { _id: { $in: request.achievement_ids } },
        { is_verified: false }
      );
    }

    return request;
  }

  /**
   * Get detailed verification request with all data
   */
  static async getVerificationRequestById(
    requestId: string
  ): Promise<IVerificationRequestDocument | null> {
    return await VerificationRequest.findById(requestId)
      .populate('tutor_id', 'full_name email phone_number')
      .populate('education_id')
      .populate('certificate_ids')
      .populate('achievement_ids')
      .populate('reviewed_by', 'full_name email');
  }

  /**
   * Collect current tutor's education, certificates, and achievements IDs for verification
   */
  static async collectTutorDataForVerification(
    tutorId: string
  ): Promise<CreateVerificationRequestData> {
    // Get education data
    const education = await Education.findOne({ tutor_id: tutorId });
    const educationId = education ? education._id : undefined;

    // Get certificates data
    const certificates = await Certificate.find({ tutor_id: tutorId }).sort({
      created_at: -1,
    });
    const certificateIds = certificates.map((cert) => cert._id);

    // Get achievements data
    const achievements = await Achievement.find({ tutor_id: tutorId }).sort({
      date_achieved: -1,
    });
    const achievementIds = achievements.map((achievement) => achievement._id);

    return {
      tutor_id: tutorId,
      education_id: educationId,
      certificate_ids: certificateIds,
      achievement_ids: achievementIds,
    };
  }
}
