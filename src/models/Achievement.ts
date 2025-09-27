import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  AchievementLevel,
  AchievementType,
  VerificationStatus,
} from '../types/verification.types';

export interface IAchievement extends Document {
  _id: string;
  tutorId: string;
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
    _id: {
      type: String,
      default: uuidv4,
    },
    tutorId: {
      type: String,
      ref: 'User',
      required: [true, 'ID gia sư không được để trống'],
    },
    name: {
      type: String,
      required: [true, 'Tên thành tích không được để trống'],
      trim: true,
    },
    level: {
      type: String,
      enum: {
        values: Object.values(AchievementLevel),
        message: 'Cấp độ thành tích không hợp lệ',
      },
      required: [true, 'Cấp độ thành tích không được để trống'],
    },
    achievedDate: {
      type: Date,
      required: [true, 'Ngày đạt được thành tích không được để trống'],
    },
    awardingOrganization: {
      type: String,
      required: [true, 'Tên tổ chức trao tặng không được để trống'],
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: Object.values(AchievementType),
        message: 'Loại thành tích không hợp lệ',
      },
      required: [true, 'Loại thành tích không được để trống'],
    },
    field: {
      type: String,
      required: [true, 'Lĩnh vực không được để trống'],
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

// Transform output to match API response format
AchievementSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const Achievement = model<IAchievement>(
  'Achievement',
  AchievementSchema
);
