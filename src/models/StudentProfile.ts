import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IStudentProfile } from '../types/student.types';

export interface IStudentProfileDocument extends IStudentProfile, Document {}

const studentProfileSchema = new Schema<IStudentProfileDocument>(
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
    learning_goals: {
      type: String,
      trim: true,
      maxlength: [1000, 'Mục tiêu học tập không được vượt quá 1000 ký tự'],
      default: null,
    },
    preferred_subjects: {
      type: [String],
      default: [],
      validate: {
        validator: function (v: string[]) {
          return v.length <= 10;
        },
        message: 'Không thể chọn quá 10 môn học yêu thích',
      },
    },
    learning_style: {
      type: String,
      enum: ['visual', 'auditory', 'kinesthetic', 'reading_writing'],
      default: null,
    },
    availability_schedule: {
      type: String,
      trim: true,
      maxlength: [500, 'Lịch học không được vượt quá 500 ký tự'],
      default: null,
    },
    budget_range: {
      min: {
        type: Number,
        min: [0, 'Giá tối thiểu không được âm'],
        default: null,
      },
      max: {
        type: Number,
        min: [0, 'Giá tối đa không được âm'],
        default: null,
      },
    },
    interests: {
      type: String,
      trim: true,
      maxlength: [1000, 'Sở thích không được vượt quá 1000 ký tự'],
      default: null,
    },
    special_needs: {
      type: String,
      trim: true,
      maxlength: [500, 'Nhu cầu đặc biệt không được vượt quá 500 ký tự'],
      default: null,
    },
    parent_contact: {
      name: {
        type: String,
        trim: true,
        maxlength: [100, 'Tên phụ huynh không được vượt quá 100 ký tự'],
        default: null,
      },
      phone: {
        type: String,
        trim: true,
        match: [/^(\+84|0)[3|5|7|8|9][0-9]{8}$/, 'Số điện thoại phụ huynh không hợp lệ'],
        default: null,
      },
      relationship: {
        type: String,
        trim: true,
        maxlength: [50, 'Mối quan hệ không được vượt quá 50 ký tự'],
        default: null,
      },
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'inactive'],
      default: 'draft',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  }
);

// Custom validator for budget range
studentProfileSchema.pre('save', function (next) {
  if (this.budget_range && this.budget_range.min && this.budget_range.max) {
    if (this.budget_range.min > this.budget_range.max) {
      const error = new Error('Giá tối thiểu không thể lớn hơn giá tối đa');
      return next(error);
    }
  }
  next();
});

// Indexes for better performance
studentProfileSchema.index({ user_id: 1 });
studentProfileSchema.index({ status: 1 });
studentProfileSchema.index({ preferred_subjects: 1 });

export const StudentProfile = mongoose.model<IStudentProfileDocument>(
  'StudentProfile',
  studentProfileSchema
);