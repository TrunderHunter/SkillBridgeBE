import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  EducationLevel,
  VerificationStatus,
} from '../types/verification.types';

export interface IEducation extends Document {
  _id: string;
  tutorId: string;
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
    _id: {
      type: String,
      default: uuidv4,
    },
    tutorId: {
      type: String,
      ref: 'User',
      required: [true, 'ID gia sư không được để trống'],
      unique: true, // 1-1 relationship with Tutor
    },
    level: {
      type: String,
      enum: {
        values: Object.values(EducationLevel),
        message: 'Trình độ học vấn không hợp lệ',
      },
      required: [true, 'Trình độ học vấn không được để trống'],
    },
    school: {
      type: String,
      required: [true, 'Tên trường không được để trống'],
      trim: true,
    },
    major: {
      type: String,
      trim: true,
    },
    imgUrl: {
      type: String,
    },
    startYear: {
      type: Number,
      required: [true, 'Năm bắt đầu không được để trống'],
      min: [1950, 'Năm bắt đầu phải từ năm 1950 trở đi'],
      max: [
        new Date().getFullYear(),
        `Năm bắt đầu không được vượt quá năm ${new Date().getFullYear()}`,
      ],
    },
    endYear: {
      type: Number,
      required: [true, 'Năm kết thúc không được để trống'],
      min: [1950, 'Năm kết thúc phải từ năm 1950 trở đi'],
      max: [
        new Date().getFullYear() + 10,
        `Năm kết thúc không được vượt quá năm ${new Date().getFullYear() + 10}`,
      ],
    },
    status: {
      type: String,
      enum: Object.values(VerificationStatus),
      default: VerificationStatus.DRAFT,
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

// Transform output to match API response format
EducationSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const Education = model<IEducation>('Education', EducationSchema);
