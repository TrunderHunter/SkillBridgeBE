import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ICertificate {
  _id: string;
  tutor_id: string;
  name: string;
  description: string;
  issued_by: string;
  issue_date?: Date;
  expiry_date?: Date;
  certificate_image_url?: string;
  certificate_image_public_id?: string;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ICertificateDocument extends ICertificate, Document {
  _id: string;
}

const certificateSchema = new Schema<ICertificateDocument>(
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
      required: [true, 'Certificate name is required'],
      trim: true,
      maxlength: [200, 'Certificate name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Certificate description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    issued_by: {
      type: String,
      required: [true, 'Issuing organization is required'],
      trim: true,
      maxlength: [200, 'Issuing organization cannot exceed 200 characters'],
    },
    issue_date: {
      type: Date,
      default: null,
    },
    expiry_date: {
      type: Date,
      default: null,
    },
    certificate_image_url: {
      type: String,
      default: null,
    },
    certificate_image_public_id: {
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
    collection: 'certificates',
  }
);

// Indexes
certificateSchema.index({ tutor_id: 1 });
certificateSchema.index({ tutor_id: 1, is_verified: 1 });
certificateSchema.index({ issued_by: 1 });

// Validate expiry_date > issue_date
certificateSchema.pre('save', function (next) {
  if (this.issue_date && this.expiry_date) {
    if (this.expiry_date <= this.issue_date) {
      return next(new Error('Expiry date must be after issue date'));
    }
  }
  next();
});

export const Certificate = mongoose.model<ICertificateDocument>(
  'Certificate',
  certificateSchema
);
