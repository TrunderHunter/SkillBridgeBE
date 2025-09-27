import { Schema, model, Document } from 'mongoose';
import { VerificationStatus } from '../types/verification.types';

export interface ICertificate extends Document {
  tutorId: Schema.Types.ObjectId;
  name: string;
  issuingOrganization: string;
  description?: string;
  issueDate: Date;
  expiryDate?: Date;
  imageUrl: string;
  status: VerificationStatus;
  rejectionReason?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Backup của thông tin đã xác thực (dùng khi sửa đổi)
  verifiedData?: {
    name: string;
    issuingOrganization: string;
    description?: string;
    issueDate: Date;
    expiryDate?: Date;
    imageUrl: string;
  };
}

const CertificateSchema = new Schema<ICertificate>(
  {
    tutorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    issuingOrganization: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    issueDate: {
      type: Date,
      required: true,
    },
    expiryDate: {
      type: Date,
    },
    imageUrl: {
      type: String,
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
    verifiedAt: {
      type: Date,
    },
    verifiedData: {
      name: {
        type: String,
        trim: true,
      },
      issuingOrganization: {
        type: String,
        trim: true,
      },
      description: {
        type: String,
        trim: true,
      },
      issueDate: {
        type: Date,
      },
      expiryDate: {
        type: Date,
      },
      imageUrl: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Validation: expiryDate phải lớn hơn issueDate (nếu có)
CertificateSchema.pre('save', function (next) {
  if (this.expiryDate && this.expiryDate <= this.issueDate) {
    return next(new Error('Ngày hết hạn phải sau ngày cấp'));
  }
  next();
});

// Index cho tìm kiếm nhanh
CertificateSchema.index({ tutorId: 1 });
CertificateSchema.index({ status: 1 });
CertificateSchema.index({ tutorId: 1, status: 1 });

export const Certificate = model<ICertificate>(
  'Certificate',
  CertificateSchema
);
