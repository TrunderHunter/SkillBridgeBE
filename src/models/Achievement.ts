import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum AchievementType {
  COMPETITION = 'Cuộc thi',
  AWARD = 'Giải thưởng',
  CERTIFICATION = 'Chứng nhận',
  PUBLICATION = 'Xuất bản',
  RESEARCH = 'Nghiên cứu',
  PROJECT = 'Dự án',
  OTHER = 'Khác',
}

export enum AchievementLevel {
  INTERNATIONAL = 'Quốc tế',
  NATIONAL = 'Quốc gia',
  REGIONAL = 'Khu vực',
  LOCAL = 'Địa phương',
  INSTITUTIONAL = 'Cơ quan/Trường học',
  OTHER = 'Khác',
}

export interface IAchievement {
  _id: string;
  tutor_id: string;
  name: string;
  level: AchievementLevel;
  date_achieved: Date;
  organization: string;
  type: AchievementType;
  field: string;
  description: string;
  achievement_image_url?: string;
  achievement_image_public_id?: string;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IAchievementDocument extends IAchievement, Document {
  _id: string;
}

const achievementSchema = new Schema<IAchievementDocument>(
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
    name: {
      type: String,
      required: [true, 'Achievement name is required'],
      trim: true,
      maxlength: [200, 'Achievement name cannot exceed 200 characters'],
    },
    level: {
      type: String,
      required: [true, 'Achievement level is required'],
      enum: Object.values(AchievementLevel),
    },
    date_achieved: {
      type: Date,
      required: [true, 'Date achieved is required'],
    },
    organization: {
      type: String,
      required: [true, 'Organization is required'],
      trim: true,
      maxlength: [200, 'Organization cannot exceed 200 characters'],
    },
    type: {
      type: String,
      required: [true, 'Achievement type is required'],
      enum: Object.values(AchievementType),
    },
    field: {
      type: String,
      required: [true, 'Field is required'],
      trim: true,
      maxlength: [100, 'Field cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    achievement_image_url: {
      type: String,
      default: null,
    },
    achievement_image_public_id: {
      type: String,
      default: null,
    },
    is_verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    collection: 'achievements',
  }
);

// Indexes
achievementSchema.index({ tutor_id: 1 });
achievementSchema.index({ tutor_id: 1, is_verified: 1 });
achievementSchema.index({ type: 1 });
achievementSchema.index({ level: 1 });
achievementSchema.index({ date_achieved: -1 });

// Validate date_achieved is not in the future
achievementSchema.pre('save', function (next) {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today

  if (this.date_achieved > today) {
    return next(new Error('Date achieved cannot be in the future'));
  }

  next();
});

export const Achievement = mongoose.model<IAchievementDocument>(
  'Achievement',
  achievementSchema
);
