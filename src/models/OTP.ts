import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IOTPRecord, OTPType } from '../types/user.types';

export interface IOTPDocument extends IOTPRecord, Document {
  _id: string;
}

const otpSchema = new Schema<IOTPDocument>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    otp_code: {
      type: String,
      required: [true, 'OTP code is required'],
      length: [6, 'OTP must be 6 digits'],
    },
    expires_at: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
    },
    is_used: {
      type: Boolean,
      default: false,
    },
    otp_type: {
      type: String,
      enum: Object.values(OTPType),
      required: true,
      default: OTPType.REGISTRATION,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
  }
);

// Index for better performance and auto-cleanup
otpSchema.index({ email: 1, otp_type: 1 });
otpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 }); // Auto delete expired docs

export const OTP = mongoose.model<IOTPDocument>('OTP', otpSchema);
