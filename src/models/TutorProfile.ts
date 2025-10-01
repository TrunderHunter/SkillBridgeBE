import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ITutorProfile } from '../types/user.types';
import { VerificationStatus } from '../types/verification.types';

export interface ITutorProfileDocument extends ITutorProfile, Document {
  _id: string;
}

const tutorProfileSchema = new Schema<ITutorProfileDocument>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    user_id: {
      type: String,
      required: [true, 'User ID is required'],
      unique: true,
      ref: 'User',
    },
    headline: {
      type: String,
      trim: true,
      maxlength: [150, 'Tiêu đề không được vượt quá 150 ký tự'],
      default: null,
    },
    introduction: {
      type: String,
      trim: true,
      maxlength: [2000, 'Phần giới thiệu không được vượt quá 2000 ký tự'],
      default: null,
    },
    teaching_experience: {
      type: String,
      trim: true,
      maxlength: [1000, 'Kinh nghiệm giảng dạy không được vượt quá 1000 ký tự'],
      default: null,
    },
    student_levels: {
      type: String,
      trim: true,
      maxlength: [500, 'Trình độ học viên không được vượt quá 500 ký tự'],
      default: null,
    },
    video_intro_link: {
      type: String,
      trim: true,
      default: null,
    },
    cccd_images: {
      type: [String],
      default: [],
      validate: {
        validator: function (v: string[]) {
          return v.length <= 10; // Max 10 CCCD images
        },
        message: 'Không thể tải lên quá 10 ảnh CCCD',
      },
    },
    // Trạng thái xác thực của thông tin gia sư
    status: {
      type: String,
      enum: Object.values(VerificationStatus),
      default: VerificationStatus.DRAFT,
    },
    // Lý do từ chối (nếu có)
    rejection_reason: {
      type: String,
      trim: true,
      default: null,
    },
    // Thời gian xác thực
    verified_at: {
      type: Date,
      default: null,
    },
    // Người xác thực
    verified_by: {
      type: String,
      ref: 'User',
      default: null,
    },
    // Backup dữ liệu đã được xác thực (để restore khi bị reject)
    verified_data: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  }
);

// Indexes for better performance
tutorProfileSchema.index({ user_id: 1 });
tutorProfileSchema.index({ status: 1 });
tutorProfileSchema.index({ verified_at: 1 });

// Transform output to match API response format
tutorProfileSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const TutorProfile = mongoose.model<ITutorProfileDocument>(
  'TutorProfile',
  tutorProfileSchema
);
