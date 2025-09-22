import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum VerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface IVerificationRequest {
  _id: string;
  tutor_id: string;
  status: VerificationStatus;
  education_id?: string; // Reference to Education document
  certificate_ids: string[]; // References to Certificate documents
  achievement_ids: string[]; // References to Achievement documents
  admin_feedback?: string;
  reviewed_by?: string;
  reviewed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface IVerificationRequestDocument
  extends IVerificationRequest,
    Document {
  _id: string;
}

const verificationRequestSchema = new Schema<IVerificationRequestDocument>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    tutor_id: {
      type: String,
      required: [true, 'Tutor ID is required'],
      ref: 'User',
    },
    status: {
      type: String,
      enum: Object.values(VerificationStatus),
      default: VerificationStatus.PENDING,
    },
    education_id: {
      type: String,
      ref: 'Education',
      default: null,
    },
    certificate_ids: {
      type: [String],
      ref: 'Certificate',
      default: [],
    },
    achievement_ids: {
      type: [String],
      ref: 'Achievement',
      default: [],
    },
    admin_feedback: {
      type: String,
      default: null,
    },
    reviewed_by: {
      type: String,
      ref: 'User',
      default: null,
    },
    reviewed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    collection: 'verification_requests',
  }
);

// Indexes
verificationRequestSchema.index({ tutor_id: 1 });
verificationRequestSchema.index({ status: 1 });
verificationRequestSchema.index({ created_at: -1 });
verificationRequestSchema.index({ tutor_id: 1, status: 1 });

// Prevent multiple pending requests from same tutor
verificationRequestSchema.index(
  { tutor_id: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: VerificationStatus.PENDING },
  }
);

export const VerificationRequest = mongoose.model<IVerificationRequestDocument>(
  'VerificationRequest',
  verificationRequestSchema
);
