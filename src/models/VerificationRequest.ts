import { Schema, model, Document } from 'mongoose';
import { RequestStatus } from '../types/verification.types';

export interface IVerificationRequest extends Document {
  tutorId: Schema.Types.ObjectId;
  status: RequestStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: Schema.Types.ObjectId;
  adminNote?: string;
  result?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationRequestSchema = new Schema<IVerificationRequest>(
  {
    tutorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(RequestStatus),
      default: RequestStatus.PENDING,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    adminNote: {
      type: String,
      trim: true,
    },
    result: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index cho tìm kiếm nhanh
VerificationRequestSchema.index({ tutorId: 1 });
VerificationRequestSchema.index({ status: 1 });
VerificationRequestSchema.index({ submittedAt: -1 });
VerificationRequestSchema.index({ tutorId: 1, status: 1 });

// Virtual để lấy danh sách VerificationDetail
VerificationRequestSchema.virtual('details', {
  ref: 'VerificationDetail',
  localField: '_id',
  foreignField: 'requestId',
});

// Đảm bảo virtual fields được include khi convert sang JSON
VerificationRequestSchema.set('toJSON', { virtuals: true });
VerificationRequestSchema.set('toObject', { virtuals: true });

export const VerificationRequest = model<IVerificationRequest>(
  'VerificationRequest',
  VerificationRequestSchema
);
