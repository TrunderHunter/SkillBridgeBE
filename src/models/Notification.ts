import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId: string; // Changed from ObjectId to String to match User UUID format
  type:
    | 'CONTACT_REQUEST'
    | 'CLASS_CREATED'
    | 'HOMEWORK_ASSIGNED'
    | 'HOMEWORK_SUBMITTED'
    | 'HOMEWORK_GRADED'
    | 'ATTENDANCE_MARKED'
    | 'CANCELLATION_REQUESTED'
    | 'CANCELLATION_RESPONDED'
    | 'MESSAGE'
    | 'SYSTEM'
    | 'CONTRACT_CREATED'
    | 'CONTRACT_APPROVED'
    | 'CONTRACT_REJECTED'
    | 'CONTRACT_EXPIRED'
    | 'CONTRACT_CANCELLED';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
  actionUrl?: string;
  createdAt: Date;
  readAt?: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: String, // Changed from ObjectId to String to match User UUID format
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'CONTACT_REQUEST',
        'CLASS_CREATED',
        'HOMEWORK_ASSIGNED',
        'HOMEWORK_SUBMITTED',
        'HOMEWORK_GRADED',
        'ATTENDANCE_MARKED',
        'CANCELLATION_REQUESTED',
        'CANCELLATION_RESPONDED',
        'MESSAGE',
        'SYSTEM',
        'CONTRACT_CREATED',
        'CONTRACT_APPROVED',
        'CONTRACT_REJECTED',
        'CONTRACT_EXPIRED',
        'CONTRACT_CANCELLED',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical'],
      default: 'normal',
    },
    actionUrl: {
      type: String,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1 });
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
); // Auto-delete after 30 days

export const Notification = mongoose.model<INotification>(
  'Notification',
  NotificationSchema
);
