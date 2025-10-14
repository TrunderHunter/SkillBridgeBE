import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ILearningSession {
  sessionNumber: number;
  scheduledDate: Date;
  duration: number; // minutes
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'MISSED';
  actualStartTime?: Date;
  actualEndTime?: Date;
  notes?: string;
  homework?: string;
  studentFeedback?: {
    rating: number; // 1-5
    comment?: string;
    submittedAt: Date;
  };
  tutorFeedback?: {
    performance: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'NEEDS_IMPROVEMENT';
    attendance: 'ON_TIME' | 'LATE' | 'ABSENT';
    comment?: string;
    submittedAt: Date;
  };
}

export interface ILearningClass extends Document {
  _id: string;
  contactRequestId: string; // Reference to ContactRequest
  studentId: string;
  tutorId: string;
  tutorPostId: string;
  subject: string;
  
  // Class details
  title: string;
  description?: string;
  pricePerSession: number;
  sessionDuration: number; // minutes
  totalSessions: number;
  learningMode: 'ONLINE' | 'OFFLINE';
  
  // Schedule
  schedule: {
    dayOfWeek: number[]; // [1, 3, 5] for Mon, Wed, Fri
    startTime: string; // "19:00"
    endTime: string; // "20:30"
    timezone: string; // "Asia/Ho_Chi_Minh"
  };
  
  // Duration
  startDate: Date;
  expectedEndDate: Date;
  actualEndDate?: Date;
  
  // Location (for offline classes)
  location?: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  
  // Online meeting info (for online classes)
  onlineInfo?: {
    platform: 'ZOOM' | 'GOOGLE_MEET' | 'MICROSOFT_TEAMS' | 'OTHER';
    meetingLink?: string;
    meetingId?: string;
    password?: string;
  };
  
  // Progress tracking
  sessions: ILearningSession[];
  completedSessions: number;
  
  // Status
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'PAUSED';
  
  // Payment info
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'PENDING' | 'PARTIAL' | 'COMPLETED';
  
  createdAt: Date;
  updatedAt: Date;
}

const LearningSessionSchema = new Schema<ILearningSession>({
  sessionNumber: { type: Number, required: true },
  scheduledDate: { type: Date, required: true },
  duration: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'MISSED'],
    default: 'SCHEDULED'
  },
  actualStartTime: Date,
  actualEndTime: Date,
  notes: { type: String, maxlength: 1000 },
  homework: { type: String, maxlength: 1000 },
  
  studentFeedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, maxlength: 500 },
    submittedAt: Date,
  },
  
  tutorFeedback: {
    performance: {
      type: String,
      enum: ['EXCELLENT', 'GOOD', 'AVERAGE', 'NEEDS_IMPROVEMENT']
    },
    attendance: {
      type: String,
      enum: ['ON_TIME', 'LATE', 'ABSENT']
    },
    comment: { type: String, maxlength: 500 },
    submittedAt: Date,
  },
}, { _id: false });

const LearningClassSchema = new Schema<ILearningClass>(
  {
    _id: { type: String, default: uuidv4 },
    contactRequestId: { type: String, required: true, ref: 'ContactRequest' },
    studentId: { type: String, required: true, ref: 'User' },
    tutorId: { type: String, required: true, ref: 'User' },
    tutorPostId: { type: String, required: true, ref: 'TutorPost' },
    subject: { type: String, required: true, ref: 'Subject' },
    
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    pricePerSession: { type: Number, required: true, min: 50000 },
    sessionDuration: { type: Number, required: true, enum: [60, 90, 120, 150, 180] },
    totalSessions: { type: Number, required: true, min: 1, max: 100 },
    learningMode: { type: String, required: true, enum: ['ONLINE', 'OFFLINE'] },
    
    schedule: {
      dayOfWeek: [{ type: Number, min: 0, max: 6 }],
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      timezone: { type: String, default: 'Asia/Ho_Chi_Minh' },
    },
    
    startDate: { type: Date, required: true },
    expectedEndDate: { type: Date, required: true },
    actualEndDate: Date,
    
    location: {
      address: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    
    onlineInfo: {
      platform: { type: String, enum: ['ZOOM', 'GOOGLE_MEET', 'MICROSOFT_TEAMS', 'OTHER'] },
      meetingLink: String,
      meetingId: String,
      password: String,
    },
    
    sessions: [LearningSessionSchema],
    completedSessions: { type: Number, default: 0 },
    
    status: { 
      type: String, 
      enum: ['ACTIVE', 'COMPLETED', 'CANCELLED', 'PAUSED'],
      default: 'ACTIVE'
    },
    
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    paymentStatus: { 
      type: String, 
      enum: ['PENDING', 'PARTIAL', 'COMPLETED'],
      default: 'PENDING'
    },
  },
  {
    timestamps: true,
    collection: 'learning_classes',
  }
);

// Indexes
LearningClassSchema.index({ studentId: 1, status: 1 });
LearningClassSchema.index({ tutorId: 1, status: 1 });
LearningClassSchema.index({ status: 1, startDate: 1 });

export const LearningClass = model<ILearningClass>('LearningClass', LearningClassSchema);