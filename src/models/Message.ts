import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IMessage extends Document {
  _id: string;
  conversationId: string; // Reference to Conversation
  senderId: string; // Reference to User (who sent the message)
  receiverId: string; // Reference to User (who receives the message)
  
  // Message content
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'FILE';
  
  // File/Image metadata (if applicable)
  fileMetadata?: {
    originalName: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileUrl: string;
  };
  
  // Message status
  status: 'SENT' | 'DELIVERED' | 'READ';
  
  // Reply to another message (optional)
  replyTo?: {
    messageId: string;
    content: string; // Preview of the message being replied to
  };
  
  // Timestamps
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  
  // Soft delete
  isDeleted: boolean;
  deletedAt?: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    conversationId: {
      type: String,
      required: true,
      ref: 'Conversation',
    },
    senderId: {
      type: String,
      required: true,
      ref: 'User',
    },
    receiverId: {
      type: String,
      required: true,
      ref: 'User',
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000, // Limit message length
    },
    messageType: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'FILE'],
      default: 'TEXT',
    },
    fileMetadata: {
      originalName: String,
      fileName: String,
      fileSize: Number,
      mimeType: String,
      fileUrl: String,
    },
    status: {
      type: String,
      enum: ['SENT', 'DELIVERED', 'READ'],
      default: 'SENT',
    },
    replyTo: {
      messageId: String,
      content: String,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    deliveredAt: Date,
    readAt: Date,
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: false, // We handle timestamps manually
    _id: false,
  }
);

// Indexes for better performance
MessageSchema.index({ conversationId: 1, sentAt: -1 });
MessageSchema.index({ senderId: 1, sentAt: -1 });
MessageSchema.index({ receiverId: 1, status: 1 });
MessageSchema.index({ sentAt: -1 });
MessageSchema.index({ isDeleted: 1 });

// Compound index for conversation messages
MessageSchema.index({ conversationId: 1, isDeleted: 1, sentAt: -1 });

export const Message = model<IMessage>('Message', MessageSchema);