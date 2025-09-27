import { Types } from 'mongoose';
import {
  VerificationRequest,
  VerificationDetail,
  Education,
  Certificate,
  Achievement,
} from '../../models';
import {
  VerificationStatus,
  RequestStatus,
} from '../../types/verification.types';
import { VerificationTargetType } from '../../models/VerificationDetail';
import { QualificationService } from './qualification.service';

export class AdminVerificationService {
  /**
   * Lấy danh sách yêu cầu xác thực với filter
   */
  static async getVerificationRequests(
    filters: {
      status?: RequestStatus;
      tutorId?: Types.ObjectId;
      page?: number;
      limit?: number;
    } = {}
  ) {
    try {
      const { status, tutorId, page = 1, limit = 10 } = filters;
      const query: any = {};

      if (status) query.status = status;
      if (tutorId) query.tutorId = tutorId;

      const skip = (page - 1) * limit;

      const [requests, total] = await Promise.all([
        VerificationRequest.find(query)
          .populate('tutorId', 'fullName email')
          .populate('reviewedBy', 'fullName email')
          .sort({ submittedAt: -1 })
          .skip(skip)
          .limit(limit),
        VerificationRequest.countDocuments(query),
      ]);

      return {
        requests,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      throw new Error(`Lỗi lấy danh sách yêu cầu xác thực: ${error.message}`);
    }
  }

  /**
   * Lấy chi tiết một yêu cầu xác thực
   */
  static async getVerificationRequestDetail(requestId: Types.ObjectId) {
    try {
      const request = await VerificationRequest.findById(requestId)
        .populate('tutorId', 'fullName email')
        .populate('reviewedBy', 'fullName email');

      if (!request) {
        throw new Error('Không tìm thấy yêu cầu xác thực');
      }

      const details = await VerificationDetail.find({ requestId }).sort({
        createdAt: 1,
      });

      // Populate target objects dựa trên targetType
      const populatedDetails = await Promise.all(
        details.map(async (detail) => {
          let targetData = null;

          switch (detail.targetType) {
            case VerificationTargetType.EDUCATION:
              targetData = await Education.findById(detail.targetId);
              break;
            case VerificationTargetType.CERTIFICATE:
              targetData = await Certificate.findById(detail.targetId);
              break;
            case VerificationTargetType.ACHIEVEMENT:
              targetData = await Achievement.findById(detail.targetId);
              break;
          }

          return {
            ...detail.toObject(),
            target: targetData,
          };
        })
      );

      return {
        request,
        details: populatedDetails,
      };
    } catch (error: any) {
      throw new Error(`Lỗi lấy chi tiết yêu cầu xác thực: ${error.message}`);
    }
  }

  /**
   * 5. Xử lý yêu cầu xác thực (chấp nhận/từ chối từng mục)
   */
  static async processVerificationRequest(
    requestId: Types.ObjectId,
    adminId: Types.ObjectId,
    decisions: {
      detailId: Types.ObjectId;
      status: VerificationStatus.VERIFIED | VerificationStatus.REJECTED;
      rejectionReason?: string;
    }[],
    adminNote?: string
  ) {
    try {
      const request = await VerificationRequest.findById(requestId);
      if (!request) {
        throw new Error('Không tìm thấy yêu cầu xác thực');
      }

      if (request.status !== RequestStatus.PENDING) {
        throw new Error('Yêu cầu này đã được xử lý');
      }

      let approvedCount = 0;
      let rejectedCount = 0;

      // Xử lý từng detail
      for (const decision of decisions) {
        const detail = await VerificationDetail.findById(decision.detailId);
        if (!detail || detail.requestId.toString() !== requestId.toString()) {
          continue;
        }

        // Cập nhật trạng thái detail
        detail.status = decision.status;
        detail.rejectionReason = decision.rejectionReason;
        detail.reviewedAt = new Date();
        detail.reviewedBy = adminId as any;
        await detail.save();

        // Cập nhật trạng thái target object
        await this.updateTargetStatus(
          detail.targetType,
          new Types.ObjectId(detail.targetId.toString()),
          decision.status,
          decision.rejectionReason
        );

        if (decision.status === VerificationStatus.VERIFIED) {
          approvedCount++;
        } else {
          rejectedCount++;
        }
      }

      // Xác định trạng thái request
      let requestStatus: RequestStatus;
      if (approvedCount > 0 && rejectedCount > 0) {
        requestStatus = RequestStatus.PARTIALLY_APPROVED;
      } else if (approvedCount > 0) {
        requestStatus = RequestStatus.APPROVED;
      } else {
        requestStatus = RequestStatus.REJECTED;
      }

      // Cập nhật request
      request.status = requestStatus;
      request.reviewedAt = new Date();
      request.reviewedBy = adminId as any;
      request.adminNote = adminNote;
      request.result = `Chấp nhận: ${approvedCount}, Từ chối: ${rejectedCount}`;
      await request.save();

      return request;
    } catch (error: any) {
      throw new Error(`Lỗi xử lý yêu cầu xác thực: ${error.message}`);
    }
  }

  /**
   * Cập nhật trạng thái target object
   */
  private static async updateTargetStatus(
    targetType: VerificationTargetType,
    targetId: Types.ObjectId,
    status: VerificationStatus,
    rejectionReason?: string
  ) {
    try {
      const updateData: any = {
        status,
        rejectionReason,
      };

      if (status === VerificationStatus.VERIFIED) {
        updateData.verifiedAt = new Date();
        updateData.rejectionReason = undefined;
        updateData.verifiedData = undefined; // Clear backup data
      } else if (status === VerificationStatus.REJECTED) {
        // 5.2. Khôi phục dữ liệu đã xác thực nếu bị từ chối
        await QualificationService.restoreVerifiedData(targetType, targetId);
        return; // Exit early as restoreVerifiedData handles the update
      }

      switch (targetType) {
        case VerificationTargetType.EDUCATION:
          await Education.findByIdAndUpdate(targetId, updateData);
          break;
        case VerificationTargetType.CERTIFICATE:
          await Certificate.findByIdAndUpdate(targetId, updateData);
          break;
        case VerificationTargetType.ACHIEVEMENT:
          await Achievement.findByIdAndUpdate(targetId, updateData);
          break;
      }
    } catch (error: any) {
      throw new Error(`Lỗi cập nhật trạng thái target: ${error.message}`);
    }
  }

  /**
   * Lấy lịch sử xác thực
   */
  static async getVerificationHistory(
    filters: {
      tutorId?: Types.ObjectId;
      targetType?: VerificationTargetType;
      page?: number;
      limit?: number;
    } = {}
  ) {
    try {
      const { tutorId, targetType, page = 1, limit = 20 } = filters;

      // Build aggregation pipeline
      const matchStage: any = {};
      const skip = (page - 1) * limit;

      const pipeline: any[] = [
        // Lookup request info
        {
          $lookup: {
            from: 'verificationrequests',
            localField: 'requestId',
            foreignField: '_id',
            as: 'request',
          },
        },
        { $unwind: '$request' },

        // Match filters
        {
          $match: {
            ...(tutorId && { 'request.tutorId': tutorId }),
            ...(targetType && { targetType }),
            status: {
              $in: [VerificationStatus.VERIFIED, VerificationStatus.REJECTED],
            },
          },
        },

        // Lookup tutor info
        {
          $lookup: {
            from: 'users',
            localField: 'request.tutorId',
            foreignField: '_id',
            as: 'tutor',
          },
        },
        { $unwind: '$tutor' },

        // Lookup reviewer info
        {
          $lookup: {
            from: 'users',
            localField: 'reviewedBy',
            foreignField: '_id',
            as: 'reviewer',
          },
        },
        { $unwind: { path: '$reviewer', preserveNullAndEmptyArrays: true } },

        // Sort by review date
        { $sort: { reviewedAt: -1 } },

        // Pagination
        { $skip: skip },
        { $limit: limit },

        // Project fields
        {
          $project: {
            targetType: 1,
            targetId: 1,
            requestType: 1,
            status: 1,
            rejectionReason: 1,
            reviewedAt: 1,
            'tutor.fullName': 1,
            'tutor.email': 1,
            'reviewer.fullName': 1,
            'reviewer.email': 1,
            'request.submittedAt': 1,
            'request.status': 1,
          },
        },
      ];

      const [history, totalCount] = await Promise.all([
        VerificationDetail.aggregate(pipeline),
        VerificationDetail.aggregate([
          ...pipeline.slice(0, -3), // Remove sort, skip, limit, project
          { $count: 'total' },
        ]),
      ]);

      const total = totalCount[0]?.total || 0;

      return {
        history,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      throw new Error(`Lỗi lấy lịch sử xác thực: ${error.message}`);
    }
  }
}
