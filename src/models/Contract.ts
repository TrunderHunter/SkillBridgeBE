import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IContract extends Document {
  _id: string;
  contactRequestId: string; // Reference to ContactRequest
  studentId: string; // Reference to User (Student)
  tutorId: string; // Reference to User (Tutor)
  tutorPostId: string; // Reference to TutorPost
  studentPostId?: string; // Reference to Post (Student Post)

  // Contract terms
  title: string; // Contract code (HĐ-xxxxx)
  description?: string; // Contract terms/conditions
  subject?: string; // Reference to Subject

  // Class info (for learning class creation)
  classTitle?: string; // Original class title from frontend
  classDescription?: string; // Original class description from frontend
  totalSessions: number;
  pricePerSession: number;
  totalAmount: number;
  sessionDuration: number; // minutes
  learningMode: 'ONLINE' | 'OFFLINE';

  // Schedule and logistics
  schedule: {
    dayOfWeek: number[]; // [1, 3, 5] for Mon, Wed, Fri
    startTime: string; // "19:00"
    endTime: string; // "20:30"
    timezone: string; // "Asia/Ho_Chi_Minh"
  };

  startDate: Date;
  expectedEndDate: Date;

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

  // Contract status
  status:
    | 'DRAFT'
    | 'PENDING_STUDENT_APPROVAL'
    | 'APPROVED'
    | 'REJECTED'
    | 'EXPIRED'
    | 'CANCELLED';

  // Student response
  studentResponse?: {
    action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
    respondedAt: Date;
    message?: string;
    requestedChanges?: string;
  };

  // Contract metadata
  contractVersion: number; // Version tracking for amendments
  previousContractId?: string; // If this is an amendment

  // Electronic signature fields
  contractHash?: string; // SHA-256 hash of contract content for integrity verification
  originalContent?: string; // JSON snapshot of contract data at signing time
  isSigned: boolean; // Whether contract has been digitally signed
  isLocked: boolean; // Locked after signing to prevent modifications
  lockedAt?: Date; // When contract was locked after signing
  studentSignedAt?: Date; // When student signed
  tutorSignedAt?: Date; // When tutor signed

  // Timestamps
  expiresAt: Date; // Auto-expire after 3 days if no response
  createdAt: Date;
  updatedAt: Date;

  // Approval tracking
  approvedAt?: Date;
  rejectedAt?: Date;

  // Cancellation tracking
  cancelledAt?: Date;
  cancelledBy?: string;
}

const ContractSchema = new Schema<IContract>(
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
    studentPostId: {
      type: String,
      required: false,
      ref: 'Post',
    },

    // Contract terms
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      ref: 'Subject',
      required: false,
    },

    // Class info (for learning class creation)
    classTitle: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    classDescription: {
      type: String,
      trim: true,
    },
    totalSessions: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    pricePerSession: {
      type: Number,
      required: true,
      min: 50000,
      max: 10000000,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    sessionDuration: {
      type: Number,
      required: true,
      enum: [60, 90, 120, 150, 180],
    },
    learningMode: {
      type: String,
      required: true,
      enum: ['ONLINE', 'OFFLINE'],
    },

    // Schedule
    schedule: {
      dayOfWeek: [
        {
          type: Number,
          min: 0,
          max: 6,
          required: true,
        },
      ],
      startTime: {
        type: String,
        required: true,
      },
      endTime: {
        type: String,
        required: true,
      },
      timezone: {
        type: String,
        default: 'Asia/Ho_Chi_Minh',
      },
    },

    startDate: {
      type: Date,
      required: true,
    },
    expectedEndDate: {
      type: Date,
      required: true,
    },

    // Location
    location: {
      address: {
        type: String,
        trim: true,
      },
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },

    // Online info
    onlineInfo: {
      platform: {
        type: String,
        enum: ['ZOOM', 'GOOGLE_MEET', 'MICROSOFT_TEAMS', 'OTHER'],
      },
      meetingLink: String,
      meetingId: String,
      password: String,
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: [
        'DRAFT',
        'PENDING_STUDENT_APPROVAL',
        'APPROVED',
        'REJECTED',
        'EXPIRED',
        'CANCELLED',
      ],
      default: 'PENDING_STUDENT_APPROVAL',
    },

    // Student response
    studentResponse: {
      action: {
        type: String,
        enum: ['APPROVE', 'REJECT', 'REQUEST_CHANGES'],
      },
      respondedAt: Date,
      message: {
        type: String,
        trim: true,
        maxlength: 500,
      },
      requestedChanges: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
    },

    // Contract metadata
    contractVersion: {
      type: Number,
      default: 1,
    },
    previousContractId: {
      type: String,
      ref: 'Contract',
    },

    // Electronic signature fields
    contractHash: {
      type: String,
      required: false,
    },
    originalContent: {
      type: String, // JSON string snapshot
      required: false,
    },
    isSigned: {
      type: Boolean,
      default: false,
      required: true,
    },
    isLocked: {
      type: Boolean,
      default: false,
      required: true,
    },
    lockedAt: {
      type: Date,
      required: false,
    },
    studentSignedAt: {
      type: Date,
      required: false,
    },
    tutorSignedAt: {
      type: Date,
      required: false,
    },

    // Auto expire
    expiresAt: {
      type: Date,
      required: true,
      default: function () {
        return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
      },
    },

    // Approval tracking
    approvedAt: Date,
    rejectedAt: Date,

    // Cancellation tracking
    cancelledAt: Date,
    cancelledBy: String,
  },
  {
    timestamps: true,
    collection: 'contracts',
  }
);

// Indexes
ContractSchema.index({ studentId: 1, status: 1, createdAt: -1 });
ContractSchema.index({ tutorId: 1, status: 1, createdAt: -1 });
ContractSchema.index({ contactRequestId: 1 });
ContractSchema.index({ status: 1, expiresAt: 1 });
ContractSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
ContractSchema.index({ isSigned: 1, isLocked: 1 }); // For finding signed/locked contracts
ContractSchema.index({ contractHash: 1 }, { sparse: true }); // For integrity verification

// Pre-save middleware to calculate totalAmount
ContractSchema.pre('save', function (next) {
  if (
    this.isModified('totalSessions') ||
    this.isModified('pricePerSession') ||
    !this.totalAmount
  ) {
    this.totalAmount = this.totalSessions * this.pricePerSession;
  }
  next();
});

// Transform output
ContractSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const Contract = model<IContract>('Contract', ContractSchema);
