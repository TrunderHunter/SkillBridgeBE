import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IRefreshToken } from '../types/user.types';

export interface IRefreshTokenDocument extends IRefreshToken, Document {
  _id: string;
}

const refreshTokenSchema = new Schema<IRefreshTokenDocument>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    user_id: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
    },
    token: {
      type: String,
      required: [true, 'Token is required'],
      unique: true,
    },
    expires_at: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
    is_revoked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
  }
);

// Indexes for better performance and auto-cleanup
refreshTokenSchema.index({ user_id: 1 });
refreshTokenSchema.index({ token: 1 });
refreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 }); // Auto delete expired docs

export const RefreshToken = mongoose.model<IRefreshTokenDocument>(
  'RefreshToken',
  refreshTokenSchema
);
