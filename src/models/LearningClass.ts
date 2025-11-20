import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Attendance tracking for each session
export interface ISessionAttendance {
  tutorAttended: boolean;
  tutorAttendedAt?: Date;
  studentAttended: boolean;
  studentAttendedAt?: Date;
}

// Homework for each session
export interface ISessionHomework {
  // Homework assigned by tutor
  assignment?: {
    title: string;
    description: string;
    fileUrl?: string; // Link to file uploaded by tutor
    deadline: Date;
    assignedAt: Date;
  };

  // Homework submission by student
  submission?: {
    fileUrl: string; // Link to file uploaded by student
    notes?: string;
    submittedAt: Date;
  };

  // Grading by tutor
  grade?: {
    score: number; // 0-10
    feedback?: string;
    gradedAt: Date;
  };
}

export interface ILearningSession {
  sessionNumber: number;
  scheduledDate: Date;
  duration: number; // minutes
  status:
    | 'SCHEDULED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'MISSED'
    | 'PENDING_CANCELLATION';
  actualStartTime?: Date;
  actualEndTime?: Date;
  notes?: string;

  // Payment tracking
  paymentStatus: 'UNPAID' | 'PENDING' | 'PAID';
  paymentRequired: boolean; // Whether payment is required to access this session

  // NEW: Attendance tracking
  attendance: ISessionAttendance;

  // NEW: Homework management
  homework?: ISessionHomework;

  // NEW: Cancellation request tracking
  cancellationRequest?: {
    requestedBy: 'TUTOR' | 'STUDENT';
    reason: string;
    requestedAt: Date;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  };

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

  studentReview?: {
    rating: number;
    comment?: string;
    submittedAt: Date;
  };

  tutorReview?: {
    rating: number;
    comment?: string;
    submittedAt: Date;
  };
}

const LearningSessionSchema = new Schema<ILearningSession>(
  {
    sessionNumber: { type: Number, required: true },
    scheduledDate: { type: Date, required: true },
    duration: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        'SCHEDULED',
        'COMPLETED',
        'CANCELLED',
        'MISSED',
        'PENDING_CANCELLATION',
      ],
      default: 'SCHEDULED',
    },
    actualStartTime: Date,
    actualEndTime: Date,
    notes: { type: String, maxlength: 1000 },

    // Payment tracking
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PENDING', 'PAID'],
      default: 'UNPAID',
      required: true,
    },
    paymentRequired: {
      type: Boolean,
      default: true,
      required: true,
    },

    // NEW: Attendance tracking
    attendance: {
      tutorAttended: { type: Boolean, default: false },
      tutorAttendedAt: Date,
      studentAttended: { type: Boolean, default: false },
      studentAttendedAt: Date,
    },

    // NEW: Homework management
    homework: {
      assignment: {
        title: { type: String, maxlength: 200 },
        description: { type: String, maxlength: 1000 },
        fileUrl: String,
        deadline: Date,
        assignedAt: Date,
      },
      submission: {
        fileUrl: String,
        notes: { type: String, maxlength: 500 },
        submittedAt: Date,
      },
      grade: {
        score: { type: Number, min: 0, max: 10 },
        feedback: { type: String, maxlength: 500 },
        gradedAt: Date,
      },
    },

    // NEW: Cancellation request tracking
    cancellationRequest: {
      requestedBy: {
        type: String,
        enum: ['TUTOR', 'STUDENT'],
      },
      reason: { type: String, maxlength: 500 },
      requestedAt: Date,
      status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING',
      },
    },

    studentFeedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, maxlength: 500 },
      submittedAt: Date,
    },

    tutorFeedback: {
      performance: {
        type: String,
        enum: ['EXCELLENT', 'GOOD', 'AVERAGE', 'NEEDS_IMPROVEMENT'],
      },
      attendance: {
        type: String,
        enum: ['ON_TIME', 'LATE', 'ABSENT'],
      },
      comment: { type: String, maxlength: 500 },
      submittedAt: Date,
    },
  },
  { _id: false }
);

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
    sessionDuration: {
      type: Number,
      required: true,
      enum: [60, 90, 120, 150, 180],
    },
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
      platform: {
        type: String,
        enum: ['ZOOM', 'GOOGLE_MEET', 'MICROSOFT_TEAMS', 'OTHER'],
      },
      meetingLink: String,
      meetingId: String,
      password: String,
    },

    sessions: [LearningSessionSchema],
    completedSessions: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'CANCELLED', 'PAUSED'],
      default: 'ACTIVE',
    },

    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PARTIAL', 'COMPLETED'],
      default: 'PENDING',
    },

    // Move these fields inside the schema object
    studentReview: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: String,
      submittedAt: Date,
    },

    tutorReview: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: String,
      submittedAt: Date,
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

export const LearningClass = model<ILearningClass>(
  'LearningClass',
  LearningClassSchema
);
