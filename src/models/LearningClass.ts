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
export interface ISessionHomeworkSubmission {
  _id: string;
  fileUrl: string;
  notes?: string;
  submittedAt: Date;
  textAnswer?: string;
  audioUrl?: string;
  speakingTranscript?: string;
}

export interface ISessionHomeworkGrade {
  score: number;
  feedback?: string;
  gradedAt: Date;
}

export interface IAssignmentAICriterion {
  label: string;
  description?: string;
  score: number;
  maxScore: number;
  feedback?: string;
}

export interface ISessionHomeworkAssignment {
  _id: string;
  id?: string;
  title: string;
  description: string;
  fileUrl?: string;
  deadline: Date;
  assignedAt: Date;
  submission?: ISessionHomeworkSubmission;
  grade?: ISessionHomeworkGrade;
  isLegacy?: boolean;
  templateId?: string;
}

export interface ISessionHomework {
  assignments?: ISessionHomeworkAssignment[];
  /**
   * @deprecated Legacy single-assignment structure (kept for backward compatibility)
   */
  assignment?: {
    title: string;
    description: string;
    fileUrl?: string;
    deadline: Date;
    assignedAt: Date;
  };
  /**
   * @deprecated Legacy submission field (use assignments[].submission instead)
   */
  submission?: {
    fileUrl: string;
    notes?: string;
    submittedAt: Date;
    textAnswer?: string;
    audioUrl?: string;
    speakingTranscript?: string;
  };
  /**
   * @deprecated Legacy grade field (use assignments[].grade instead)
   */
  grade?: {
    score: number;
    feedback?: string;
    gradedAt: Date;
  };
}

export interface IClassMaterial {
  _id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  visibility: 'STUDENTS' | 'PRIVATE';
  uploadedBy: {
    userId: string;
    role: 'TUTOR' | 'STUDENT';
    fullName: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IClassAssignmentSubmission {
  _id: string;
  studentId: string;
  studentName: string;
  note?: string;
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  submittedAt: Date;
  updatedAt: Date;
}

export interface IClassAssignment {
  _id: string;
  title: string;
  instructions?: string;
  attachment?: {
    fileUrl: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  };
  dueDate?: Date;
  createdBy: {
    userId: string;
    fullName: string;
  };
  submissions: IClassAssignmentSubmission[];
  createdAt: Date;
  updatedAt: Date;
  source?: 'CLASS' | 'SESSION';
  sessionNumber?: number;
  readOnly?: boolean;
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
  materials: IClassMaterial[];
  assignments: IClassAssignment[];

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

const SessionHomeworkSubmissionSchema = new Schema<ISessionHomeworkSubmission>(
  {
    _id: { type: String, default: uuidv4 },
    fileUrl: { type: String, required: true },
    notes: { type: String, maxlength: 500 },
    submittedAt: { type: Date, default: Date.now },
    textAnswer: { type: String, maxlength: 5000 },
    audioUrl: { type: String },
    speakingTranscript: { type: String, maxlength: 5000 },
  },
  { _id: false }
);

const SessionHomeworkGradeSchema = new Schema<ISessionHomeworkGrade>(
  {
    score: { type: Number, min: 0, max: 10, required: true },
    feedback: { type: String, maxlength: 500 },
    gradedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AssignmentAICriterionSchema = new Schema<IAssignmentAICriterion>(
  {
    label: { type: String, required: true },
    description: { type: String },
    score: { type: Number, required: true },
    maxScore: { type: Number, required: true },
    feedback: { type: String },
  },
  { _id: false }
);

const SessionHomeworkAssignmentSchema = new Schema<ISessionHomeworkAssignment>(
  {
    _id: { type: String, default: uuidv4 },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },
    fileUrl: { type: String },
    deadline: { type: Date, required: true },
    assignedAt: { type: Date, default: Date.now },
    templateId: { type: String, ref: 'ExerciseTemplate' },
    submission: { type: SessionHomeworkSubmissionSchema },
    grade: { type: SessionHomeworkGradeSchema },
    isLegacy: { type: Boolean, default: false },
  },
  { _id: false }
);

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

    // NEW: Attendance tracking
    attendance: {
      tutorAttended: { type: Boolean, default: false },
      tutorAttendedAt: Date,
      studentAttended: { type: Boolean, default: false },
      studentAttendedAt: Date,
    },

    // NEW: Homework management
    homework: {
      assignments: {
        type: [SessionHomeworkAssignmentSchema],
        default: [],
      },
      // Legacy fields kept for backward compatibility
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
        textAnswer: { type: String, maxlength: 5000 },
        audioUrl: String,
        speakingTranscript: { type: String, maxlength: 5000 },
      },
      grade: {
        score: { type: Number, min: 0, max: 10 },
        feedback: { type: String, maxlength: 500 },
        gradedAt: Date,
      },
    },

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

const ClassMaterialSchema = new Schema<IClassMaterial>(
  {
    _id: { type: String, default: uuidv4 },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    fileUrl: { type: String, required: true },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    visibility: {
      type: String,
      enum: ['STUDENTS', 'PRIVATE'],
      default: 'STUDENTS',
    },
    uploadedBy: {
      userId: { type: String, required: true },
      role: {
        type: String,
        enum: ['TUTOR', 'STUDENT'],
        required: true,
      },
      fullName: { type: String, required: true },
    },
  },
  { timestamps: true }
);

const AssignmentSubmissionSchema = new Schema<IClassAssignmentSubmission>(
  {
    _id: { type: String, default: uuidv4 },
    studentId: { type: String, required: true },
    studentName: { type: String, required: true },
    note: { type: String, maxlength: 500 },
    fileUrl: { type: String, required: true },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
  },
  { timestamps: true }
);

const ClassAssignmentSchema = new Schema<IClassAssignment>(
  {
    _id: { type: String, default: uuidv4 },
    title: { type: String, required: true, maxlength: 200 },
    instructions: { type: String, maxlength: 2000 },
    attachment: {
      fileUrl: { type: String },
      fileName: { type: String },
      fileSize: { type: Number },
      mimeType: { type: String },
    },
    dueDate: { type: Date },
    createdBy: {
      userId: { type: String, required: true },
      fullName: { type: String, required: true },
    },
    submissions: [AssignmentSubmissionSchema],
  },
  { timestamps: true }
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
    materials: {
      type: [ClassMaterialSchema],
      default: [],
    },
    assignments: {
      type: [ClassAssignmentSchema],
      default: [],
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
