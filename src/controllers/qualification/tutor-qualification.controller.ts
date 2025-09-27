import { Request, Response } from 'express';
import { Types } from 'mongoose';
import {
  QualificationService,
  QualificationSuggestionService,
} from '../../services/qualification';
import { UploadService } from '../../services/upload';
import {
  Education,
  Certificate,
  Achievement,
  VerificationRequest,
} from '../../models';
import { VerificationTargetType } from '../../models/VerificationDetail';
import {
  sendSuccess,
  sendSuccessWithQualification,
  sendError,
  toObjectId,
} from '../../utils';

export class TutorQualificationController {
  /**
   * GET /api/tutor/qualifications - Lấy toàn bộ thông tin trình độ với gợi ý
   */
  static async getQualifications(req: Request, res: Response) {
    try {
      const tutorId = toObjectId(req.user!.id);

      const [qualifications, qualificationSuggestion] = await Promise.all([
        QualificationService.getTutorQualifications(tutorId),
        QualificationSuggestionService.getQualificationSuggestion(tutorId),
      ]);

      return sendSuccessWithQualification(
        res,
        'Lấy thông tin trình độ thành công',
        qualifications,
        qualificationSuggestion
      );
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * POST /api/tutor/education - Thêm trình độ học vấn (có thể kèm ảnh)
   */
  static async createEducation(req: Request, res: Response) {
    try {
      const tutorId = toObjectId(req.user!.id);
      const file = req.file;

      // Kiểm tra đã có education chưa (1-1 relationship)
      const existingEducation = await Education.findOne({ tutorId });
      if (existingEducation) {
        return sendError(
          res,
          'Bạn đã có thông tin học vấn, chỉ có thể cập nhật',
          undefined,
          400
        );
      }

      // Upload ảnh nếu có
      let imgUrl = '';
      if (file) {
        imgUrl = await UploadService.uploadEducationImage(
          file.buffer,
          req.user!.id,
          file.originalname
        );
      }

      const education = new Education({
        tutorId,
        ...req.body,
        imgUrl: imgUrl || req.body.imgUrl, // Ưu tiên ảnh upload, fallback về URL từ body
      });

      await education.save();

      // Lấy gợi ý qualification sau khi tạo
      const qualificationSuggestion =
        await QualificationSuggestionService.getQualificationSuggestion(
          tutorId
        );

      return sendSuccessWithQualification(
        res,
        'Thêm thông tin học vấn thành công',
        education,
        qualificationSuggestion,
        201
      );
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * PUT /api/tutor/education - Sửa trình độ học vấn (có thể kèm ảnh)
   */
  static async updateEducation(req: Request, res: Response) {
    try {
      const tutorId = toObjectId(req.user!.id);
      const file = req.file;

      const education = await Education.findOne({ tutorId });
      if (!education) {
        return sendError(
          res,
          'Không tìm thấy thông tin học vấn',
          undefined,
          404
        );
      }

      // Kiểm tra có thể sửa không
      const canModify = await QualificationService.canModifyInfo(
        tutorId,
        VerificationTargetType.EDUCATION,
        education._id as Types.ObjectId
      );

      if (!canModify) {
        return sendError(
          res,
          'Không thể sửa thông tin đang chờ xác thực',
          undefined,
          400
        );
      }

      // Upload ảnh mới nếu có
      let imgUrl = education.imgUrl; // Giữ ảnh cũ
      if (file) {
        imgUrl = await UploadService.uploadEducationImage(
          file.buffer,
          req.user!.id,
          file.originalname
        );
      } else if (req.body.imgUrl !== undefined) {
        imgUrl = req.body.imgUrl; // Cập nhật từ body nếu có
      }

      // Cập nhật thông tin
      Object.assign(education, { ...req.body, imgUrl });
      await education.save();

      // Lấy gợi ý qualification sau khi cập nhật
      const qualificationSuggestion =
        await QualificationSuggestionService.getQualificationSuggestion(
          tutorId
        );

      return sendSuccessWithQualification(
        res,
        'Cập nhật thông tin học vấn thành công',
        education,
        qualificationSuggestion
      );
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * POST /api/tutor/certificates - Thêm chứng chỉ (có thể kèm ảnh)
   */
  static async createCertificate(req: Request, res: Response) {
    try {
      const tutorId = toObjectId(req.user!.id);
      const file = req.file;

      // Upload ảnh nếu có
      let imageUrl = '';
      if (file) {
        imageUrl = await UploadService.uploadCertificateImage(
          file.buffer,
          req.user!.id,
          file.originalname
        );
      }

      const certificate = new Certificate({
        tutorId,
        ...req.body,
        imageUrl: imageUrl || req.body.imageUrl, // Ưu tiên ảnh upload, fallback về URL từ body
      });

      await certificate.save();

      // Lấy gợi ý qualification sau khi tạo
      const qualificationSuggestion =
        await QualificationSuggestionService.getQualificationSuggestion(
          tutorId
        );

      return sendSuccessWithQualification(
        res,
        'Thêm chứng chỉ thành công',
        certificate,
        qualificationSuggestion,
        201
      );
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * PUT /api/tutor/certificates/:id - Sửa chứng chỉ (có thể kèm ảnh)
   */
  static async updateCertificate(req: Request, res: Response) {
    try {
      const tutorId = toObjectId(req.user!.id);
      const certificateId = new Types.ObjectId(req.params.id);
      const file = req.file;

      const certificate = await Certificate.findOne({
        _id: certificateId,
        tutorId,
      });
      if (!certificate) {
        return sendError(res, 'Không tìm thấy chứng chỉ', undefined, 404);
      }

      // Kiểm tra có thể sửa không
      const canModify = await QualificationService.canModifyInfo(
        tutorId,
        VerificationTargetType.CERTIFICATE,
        certificateId
      );

      if (!canModify) {
        return sendError(
          res,
          'Không thể sửa chứng chỉ đang chờ xác thực',
          undefined,
          400
        );
      }

      // Upload ảnh mới nếu có
      let imageUrl = certificate.imageUrl; // Giữ ảnh cũ
      if (file) {
        imageUrl = await UploadService.uploadCertificateImage(
          file.buffer,
          req.user!.id,
          file.originalname
        );
      } else if (req.body.imageUrl !== undefined) {
        imageUrl = req.body.imageUrl; // Cập nhật từ body nếu có
      }

      // Cập nhật thông tin
      Object.assign(certificate, { ...req.body, imageUrl });
      await certificate.save();

      // Lấy gợi ý qualification sau khi cập nhật
      const qualificationSuggestion =
        await QualificationSuggestionService.getQualificationSuggestion(
          tutorId
        );

      return sendSuccessWithQualification(
        res,
        'Cập nhật chứng chỉ thành công',
        certificate,
        qualificationSuggestion
      );
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * DELETE /api/tutor/certificates/:id - Xóa chứng chỉ
   */
  static async deleteCertificate(req: Request, res: Response) {
    try {
      const tutorId = toObjectId(req.user!.id);
      const certificateId = new Types.ObjectId(req.params.id);

      const certificate = await Certificate.findOne({
        _id: certificateId,
        tutorId,
      });
      if (!certificate) {
        return sendError(res, 'Không tìm thấy chứng chỉ', undefined, 404);
      }

      // Kiểm tra có thể xóa không
      const { canDelete, message } =
        await QualificationService.canDeleteCertificate(tutorId, certificateId);

      if (!canDelete) {
        return sendError(res, message!, undefined, 400);
      }

      await Certificate.findByIdAndDelete(certificateId);

      return sendSuccess(res, 'Xóa chứng chỉ thành công');
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * POST /api/tutor/achievements - Thêm thành tích (có thể kèm ảnh)
   */
  static async createAchievement(req: Request, res: Response) {
    try {
      const tutorId = toObjectId(req.user!.id);
      const file = req.file;

      // Upload ảnh nếu có
      let imgUrl = '';
      if (file) {
        imgUrl = await UploadService.uploadAchievementImage(
          file.buffer,
          req.user!.id,
          file.originalname
        );
      }

      const achievement = new Achievement({
        tutorId,
        ...req.body,
        imgUrl: imgUrl || req.body.imgUrl, // Ưu tiên ảnh upload, fallback về URL từ body
      });

      await achievement.save();

      // Lấy gợi ý qualification sau khi tạo
      const qualificationSuggestion =
        await QualificationSuggestionService.getQualificationSuggestion(
          tutorId
        );

      return sendSuccessWithQualification(
        res,
        'Thêm thành tích thành công',
        achievement,
        qualificationSuggestion,
        201
      );
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * PUT /api/tutor/achievements/:id - Sửa thành tích (có thể kèm ảnh)
   */
  static async updateAchievement(req: Request, res: Response) {
    try {
      const tutorId = toObjectId(req.user!.id);
      const achievementId = new Types.ObjectId(req.params.id);
      const file = req.file;

      const achievement = await Achievement.findOne({
        _id: achievementId,
        tutorId,
      });
      if (!achievement) {
        return sendError(res, 'Không tìm thấy thành tích', undefined, 404);
      }

      // Kiểm tra có thể sửa không
      const canModify = await QualificationService.canModifyInfo(
        tutorId,
        VerificationTargetType.ACHIEVEMENT,
        achievementId
      );

      if (!canModify) {
        return sendError(
          res,
          'Không thể sửa thành tích đang chờ xác thực',
          undefined,
          400
        );
      }

      // Upload ảnh mới nếu có
      let imgUrl = achievement.imgUrl; // Giữ ảnh cũ
      if (file) {
        imgUrl = await UploadService.uploadAchievementImage(
          file.buffer,
          req.user!.id,
          file.originalname
        );
      } else if (req.body.imgUrl !== undefined) {
        imgUrl = req.body.imgUrl; // Cập nhật từ body nếu có
      }

      // Cập nhật thông tin
      Object.assign(achievement, { ...req.body, imgUrl });
      await achievement.save();

      // Lấy gợi ý qualification sau khi cập nhật
      const qualificationSuggestion =
        await QualificationSuggestionService.getQualificationSuggestion(
          tutorId
        );

      return sendSuccessWithQualification(
        res,
        'Cập nhật thành tích thành công',
        achievement,
        qualificationSuggestion
      );
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * DELETE /api/tutor/achievements/:id - Xóa thành tích
   */
  static async deleteAchievement(req: Request, res: Response) {
    try {
      const tutorId = toObjectId(req.user!.id);
      const achievementId = new Types.ObjectId(req.params.id);

      const achievement = await Achievement.findOne({
        _id: achievementId,
        tutorId,
      });
      if (!achievement) {
        return sendError(res, 'Không tìm thấy thành tích', undefined, 404);
      }

      await Achievement.findByIdAndDelete(achievementId);

      return sendSuccess(res, 'Xóa thành tích thành công');
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }

  /**
   * POST /api/tutor/verification-requests - Tạo yêu cầu xác thực mới
   */
  static async createVerificationRequest(req: Request, res: Response) {
    try {
      const tutorId = toObjectId(req.user!.id);
      const { educationId, certificateIds, achievementIds } = req.body;

      const verificationRequest =
        await QualificationService.createVerificationRequest(tutorId, {
          educationId: educationId
            ? new Types.ObjectId(educationId)
            : undefined,
          certificateIds: certificateIds?.map(
            (id: string) => new Types.ObjectId(id)
          ),
          achievementIds: achievementIds?.map(
            (id: string) => new Types.ObjectId(id)
          ),
        });

      return sendSuccess(
        res,
        'Tạo yêu cầu xác thực thành công',
        verificationRequest,
        201
      );
    } catch (error: any) {
      return sendError(res, error.message, undefined, 400);
    }
  }

  /**
   * GET /api/tutor/verification-requests - Xem lịch sử yêu cầu xác thực
   */
  static async getVerificationRequests(req: Request, res: Response) {
    try {
      const tutorId = toObjectId(req.user!.id);
      const { page = 1, limit = 10 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const [requests, total] = await Promise.all([
        VerificationRequest.find({ tutorId })
          .populate('reviewedBy', 'fullName email')
          .sort({ submittedAt: -1 })
          .skip(skip)
          .limit(Number(limit)),
        VerificationRequest.countDocuments({ tutorId }),
      ]);

      return sendSuccess(res, 'Lấy lịch sử yêu cầu xác thực thành công', {
        requests,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error: any) {
      return sendError(res, error.message, undefined, 500);
    }
  }
}
