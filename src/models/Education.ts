import { Schema, model, Document } from 'mongoose';
import {
  EducationLevel,
  VerificationStatus,
} from '../types/verification.types';

export interface IEducation extends Document {
  tutorId: Schema.Types.ObjectId;
  level: EducationLevel;
  school: string;
  major: string;
  imgUrl?: string;
  startYear: number;
  endYear: number;
  status: VerificationStatus;
  rejectionReason?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Backup của thông tin đã xác thực (dùng khi sửa đổi)
  verifiedData?: {
    level: EducationLevel;
    school: string;
    major: string;
    startYear: number;
    endYear: number;
  };
}

const EducationSchema = new Schema<IEducation>(
  {
    tutorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // 1-1 relationship with Tutor
    },
    level: {
      type: String,
      enum: Object.values(EducationLevel),
      required: true,
    },
    school: {
      type: String,
      required: true,
      trim: true,
    },
    major: {
      type: String,
      required: true,
      trim: true,
    },
    imgUrl: {
      type: String,
    },
    startYear: {
      type: Number,
      required: true,
      min: 1950,
      max: new Date().getFullYear(),
    },
    endYear: {
      type: Number,
      required: true,
      min: 1950,
      max: new Date().getFullYear() + 10,
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
      level: {
        type: String,
        enum: Object.values(EducationLevel),
      },
      school: {
        type: String,
        trim: true,
      },
      major: {
        type: String,
        trim: true,
      },
      startYear: {
        type: Number,
        min: 1950,
      },
      endYear: {
        type: Number,
        min: 1950,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Validation: endYear phải lớn hơn startYear
EducationSchema.pre('save', function (next) {
  if (this.endYear <= this.startYear) {
    return next(new Error('Năm kết thúc phải sau năm bắt đầu'));
  }
  next();
});

// Index cho tìm kiếm nhanh
EducationSchema.index({ tutorId: 1 });
EducationSchema.index({ status: 1 });

export const Education = model<IEducation>('Education', EducationSchema);
