import { Schema, model, Document } from 'mongoose';
import {
  AchievementLevel,
  AchievementType,
  VerificationStatus,
} from '../types/verification.types';

export interface IAchievement extends Document {
  tutorId: Schema.Types.ObjectId;
  name: string;
  level: AchievementLevel;
  achievedDate: Date;
  awardingOrganization: string;
  type: AchievementType;
  field: string;
  imgUrl?: string;
  description?: string;
  status: VerificationStatus;
  rejectionReason?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Backup của thông tin đã xác thực (dùng khi sửa đổi)
  verifiedData?: {
    name: string;
    level: AchievementLevel;
    achievedDate: Date;
    awardingOrganization: string;
    type: AchievementType;
    field: string;
    description?: string;
  };
}

const AchievementSchema = new Schema<IAchievement>(
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
    level: {
      type: String,
      enum: Object.values(AchievementLevel),
      required: true,
    },
    achievedDate: {
      type: Date,
      required: true,
    },
    awardingOrganization: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(AchievementType),
      required: true,
    },
    field: {
      type: String,
      required: true,
      trim: true,
    },
    imgUrl: {
      type: String,
    },
    description: {
      type: String,
      trim: true,
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
      level: {
        type: String,
        enum: Object.values(AchievementLevel),
      },
      achievedDate: {
        type: Date,
      },
      awardingOrganization: {
        type: String,
        trim: true,
      },
      type: {
        type: String,
        enum: Object.values(AchievementType),
      },
      field: {
        type: String,
        trim: true,
      },
      description: {
        type: String,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Validation: achievedDate không được lớn hơn ngày hiện tại
AchievementSchema.pre('save', function (next) {
  if (this.achievedDate > new Date()) {
    return next(new Error('Ngày đạt được không thể sau ngày hiện tại'));
  }
  next();
});

// Index cho tìm kiếm nhanh
AchievementSchema.index({ tutorId: 1 });
AchievementSchema.index({ status: 1 });
AchievementSchema.index({ tutorId: 1, status: 1 });
AchievementSchema.index({ type: 1 });
AchievementSchema.index({ level: 1 });

export const Achievement = model<IAchievement>(
  'Achievement',
  AchievementSchema
);
