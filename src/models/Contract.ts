import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IContract extends Document {
  _id: string;
  contactRequestId: string; // Reference to ContactRequest
  studentId: string; // Reference to User (Student)
  tutorId: string; // Reference to User (Tutor)
  subject: string; // Reference to Subject

  // Contract details
  title: string;
  description?: string;
  
  // Class information
  pricePerSession: number;
  sessionDuration: number; // minutes
  totalSessions: number;
  totalAmount: number;
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
  endDate: Date;

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

  // Payment terms
  paymentTerms: {
    paymentMethod: 'FULL' | 'INSTALLMENT';
    installments?: number; // Number of installments if INSTALLMENT
    downPayment?: number; // Down payment amount if INSTALLMENT
    paymentSchedule?: string[]; // Array of PaymentSchedule IDs
  };

  // Contract terms and conditions
  terms: {
    cancellationPolicy?: string;
    refundPolicy?: string;
    makeupPolicy?: string; // Policy for making up missed sessions
    responsibilitiesOfTutor?: string;
    responsibilitiesOfStudent?: string;
    additionalTerms?: string;
  };

  // Status tracking
  status: 'DRAFT' | 'PENDING_STUDENT' | 'PENDING_TUTOR' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

  // Signature tracking
  tutorSignature?: {
    signedAt: Date;
    ipAddress?: string;
    signatureData?: string; // Base64 encoded signature image or hash
  };

  studentSignature?: {
    signedAt: Date;
    ipAddress?: string;
    signatureData?: string; // Base64 encoded signature image or hash
  };

  // Both parties must sign
  isFullySigned: boolean;

  // Contract activation
  activatedAt?: Date;

  // Linked learning class
  learningClassId?: string; // Reference to LearningClass created from this contract

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date; // Auto-expire if not signed within 7 days
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
      unique: true, // One contract per contact request
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
    subject: {
      type: String,
      required: true,
      ref: 'Subject',
    },

    // Contract details
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 1000,
    },

    // Class information
    pricePerSession: {
      type: Number,
      required: true,
      min: 50000,
    },
    sessionDuration: {
      type: Number,
      required: true,
      enum: [60, 90, 120, 150, 180],
    },
    totalSessions: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    learningMode: {
      type: String,
      required: true,
      enum: ['ONLINE', 'OFFLINE'],
    },

    // Schedule
    schedule: {
      dayOfWeek: [{
        type: Number,
        min: 0,
        max: 6,
      }],
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

    // Duration
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },

    // Location
    location: {
      address: String,
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

    // Payment terms
    paymentTerms: {
      paymentMethod: {
        type: String,
        required: true,
        enum: ['FULL', 'INSTALLMENT'],
        default: 'FULL',
      },
      installments: {
        type: Number,
        min: 2,
        max: 12,
      },
      downPayment: {
        type: Number,
        min: 0,
      },
      paymentSchedule: [{
        type: String,
        ref: 'PaymentSchedule',
      }],
    },

    // Contract terms
    terms: {
      cancellationPolicy: String,
      refundPolicy: String,
      makeupPolicy: String,
      responsibilitiesOfTutor: String,
      responsibilitiesOfStudent: String,
      additionalTerms: String,
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'PENDING_STUDENT', 'PENDING_TUTOR', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'],
      default: 'DRAFT',
    },

    // Signatures
    tutorSignature: {
      signedAt: Date,
      ipAddress: String,
      signatureData: String,
    },

    studentSignature: {
      signedAt: Date,
      ipAddress: String,
      signatureData: String,
    },

    isFullySigned: {
      type: Boolean,
      default: false,
    },

    // Activation
    activatedAt: Date,

    // Linked class
    learningClassId: {
      type: String,
      ref: 'LearningClass',
    },

    // Auto-expire
    expiresAt: {
      type: Date,
      required: true,
      default: function () {
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      },
    },
  },
  {
    timestamps: true,
    collection: 'contracts',
  }
);

// Indexes
ContractSchema.index({ studentId: 1, status: 1 });
ContractSchema.index({ tutorId: 1, status: 1 });
ContractSchema.index({ contactRequestId: 1 });
ContractSchema.index({ status: 1, createdAt: -1 });
ContractSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired contracts

// Transform output
ContractSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const Contract = model<IContract>('Contract', ContractSchema);
