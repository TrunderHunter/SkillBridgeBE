import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IConversation extends Document {
  _id: string;
  contactRequestId: string; // Reference to ContactRequest
  studentId: string; // Reference to User (Student)
  tutorId: string; // Reference to User (Tutor)
  tutorPostId: string; // Reference to TutorPost
  
  // Conversation metadata
  subject: string; // Subject they're discussing about
  status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  
  // Last message info for quick access
  lastMessage?: {
    content: string;
    senderId: string;
    sentAt: Date;
    messageType: 'TEXT' | 'IMAGE' | 'FILE';
  };
  
  // Unread counts
  unreadCount: {
    student: number;
    tutor: number;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    contactRequestId: {
      type: String,
      required: true,
      ref: 'ContactRequest',
    },
    studentId: {
      type: String,
      required: true,
      ref: 'User',
    },
    tutorId: {
      type: String,
      required: true,
      ref: 'User',
    },
    tutorPostId: {
      type: String,
      required: true,
      ref: 'TutorPost',
    },
    subject: {
      type: String,
      required: true,
      ref: 'Subject',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'CLOSED', 'ARCHIVED'],
      default: 'ACTIVE',
    },
    lastMessage: {
      content: String,
      senderId: String,
      sentAt: Date,
      messageType: {
        type: String,
        enum: ['TEXT', 'IMAGE', 'FILE'],
        default: 'TEXT',
      },
    },
    unreadCount: {
      student: {
        type: Number,
        default: 0,
      },
      tutor: {
        type: Number,
        default: 0,
      },
    },
    closedAt: Date,
  },
  {
    timestamps: true,
    _id: false,
  }
);

// Indexes for better performance
ConversationSchema.index({ contactRequestId: 1 });
ConversationSchema.index({ studentId: 1, status: 1 });
ConversationSchema.index({ tutorId: 1, status: 1 });
ConversationSchema.index({ createdAt: -1 });

// Ensure unique conversation per contact request
ConversationSchema.index({ contactRequestId: 1 }, { unique: true });

export const Conversation = model<IConversation>('Conversation', ConversationSchema);