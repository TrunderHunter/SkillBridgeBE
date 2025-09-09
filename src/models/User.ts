import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IUser, UserRole, UserStatus } from '../types/user.types';

export interface IUserDocument extends IUser, Document {
  _id: string;
}

const userSchema = new Schema<IUserDocument>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    full_name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email',
      ],
    },
    password_hash: {
      type: String,
      required: [true, 'Password is required'],
    },
    phone_number: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
      match: [
        /^(\+84|0)[3|5|7|8|9][0-9]{8}$/,
        'Please enter a valid Vietnamese phone number',
      ],
    },
    avatar_url: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.PENDING_VERIFICATION,
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  }
);

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ phone_number: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });

// Transform output to match API response format
userSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.password_hash;
    return ret;
  },
});

export const User = mongoose.model<IUserDocument>('User', userSchema);
