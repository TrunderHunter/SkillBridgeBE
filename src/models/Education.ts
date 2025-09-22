import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum EducationLevel {
  HIGH_SCHOOL = 'Trung học phổ thông',
  BACHELOR = 'Đại học',
  MASTER = 'Thạc sĩ',
  DOCTOR = 'Tiến sĩ',
}

export interface IEducation {
  _id: string;
  tutor_id: string;
  level: EducationLevel;
  school: string;
  major?: string;
  start_year: string;
  end_year: string;
  degree_image_url?: string;
  degree_image_public_id?: string;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IEducationDocument extends IEducation, Document {
  _id: string;
}

const educationSchema = new Schema<IEducationDocument>(
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
    level: {
      type: String,
      required: [true, 'Education level is required'],
      enum: Object.values(EducationLevel),
    },
    school: {
      type: String,
      required: [true, 'School name is required'],
      trim: true,
      maxlength: [200, 'School name cannot exceed 200 characters'],
    },
    major: {
      type: String,
      trim: true,
      maxlength: [100, 'Major cannot exceed 100 characters'],
    },
    start_year: {
      type: String,
      required: [true, 'Start year is required'],
      match: [/^\d{4}$/, 'Start year must be a valid 4-digit year'],
    },
    end_year: {
      type: String,
      required: [true, 'End year is required'],
      match: [/^\d{4}$/, 'End year must be a valid 4-digit year'],
    },
    degree_image_url: {
      type: String,
      default: null,
    },
    degree_image_public_id: {
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
    collection: 'educations',
  }
);

// Indexes
educationSchema.index({ tutor_id: 1 });
educationSchema.index({ tutor_id: 1, level: 1 });

// Validate start_year < end_year
educationSchema.pre('save', function (next) {
  const startYear = parseInt(this.start_year);
  const endYear = parseInt(this.end_year);

  if (startYear >= endYear) {
    return next(new Error('End year must be greater than start year'));
  }

  const currentYear = new Date().getFullYear();
  if (endYear > currentYear + 10) {
    return next(
      new Error('End year cannot be more than 10 years in the future')
    );
  }

  next();
});

export const Education = mongoose.model<IEducationDocument>(
  'Education',
  educationSchema
);
