import { Schema, model, Document } from 'mongoose';
import { RequestType, VerificationStatus } from '../types/verification.types';

// Enum cho loại đối tượng được xác thực
export enum VerificationTargetType {
  EDUCATION = 'EDUCATION',
  CERTIFICATE = 'CERTIFICATE',
  ACHIEVEMENT = 'ACHIEVEMENT',
}

export interface IVerificationDetail extends Document {
  requestId: Schema.Types.ObjectId;
  targetType: VerificationTargetType;
  targetId: Schema.Types.ObjectId;
  requestType: RequestType;
  status: VerificationStatus;
  rejectionReason?: string;
  reviewedAt?: Date;
  reviewedBy?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Snapshot của dữ liệu tại thời điểm gửi yêu cầu
  dataSnapshot: any;
}

const VerificationDetailSchema = new Schema<IVerificationDetail>(
  {
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'VerificationRequest',
      required: true,
    },
    targetType: {
      type: String,
      enum: Object.values(VerificationTargetType),
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    requestType: {
      type: String,
      enum: Object.values(RequestType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(VerificationStatus),
      default: VerificationStatus.PENDING,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    dataSnapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware để validate targetId exists
VerificationDetailSchema.pre('save', async function () {
  // Validation logic sẽ được thêm vào sau nếu cần
});

// Index cho tìm kiếm nhanh
VerificationDetailSchema.index({ requestId: 1 });
VerificationDetailSchema.index({ targetType: 1, targetId: 1 });
VerificationDetailSchema.index({ status: 1 });
VerificationDetailSchema.index({ requestId: 1, status: 1 });

// Virtual để populate target object dựa trên targetType
VerificationDetailSchema.virtual('target', {
  refPath: function () {
    if (this.targetType === VerificationTargetType.EDUCATION)
      return 'Education';
    if (this.targetType === VerificationTargetType.CERTIFICATE)
      return 'Certificate';
    if (this.targetType === VerificationTargetType.ACHIEVEMENT)
      return 'Achievement';
  },
  localField: 'targetId',
  foreignField: '_id',
  justOne: true,
});

// Đảm bảo virtual fields được include khi convert sang JSON
VerificationDetailSchema.set('toJSON', { virtuals: true });
VerificationDetailSchema.set('toObject', { virtuals: true });

export const VerificationDetail = model<IVerificationDetail>(
  'VerificationDetail',
  VerificationDetailSchema
);
