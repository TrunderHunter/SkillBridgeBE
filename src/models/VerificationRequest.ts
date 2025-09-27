import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { RequestStatus } from '../types/verification.types';

export interface IVerificationRequest extends Document {
  _id: string;
  tutorId: string;
  status: RequestStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  adminNote?: string;
  result?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationRequestSchema = new Schema<IVerificationRequest>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    tutorId: {
      type: String,
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
      type: String,
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

// Transform output to match API response format
VerificationRequestSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
  virtuals: true,
});
VerificationRequestSchema.set('toObject', { virtuals: true });

export const VerificationRequest = model<IVerificationRequest>(
  'VerificationRequest',
  VerificationRequestSchema
);
