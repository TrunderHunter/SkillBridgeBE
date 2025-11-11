import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IContactRequest extends Document {
  _id: string;
  studentId: string; // Reference to User (Student)
  tutorId: string; // Reference to User (Tutor)
  tutorPostId: string; // Reference to TutorPost

  // Who initiated this request
  initiatedBy: 'STUDENT' | 'TUTOR';
  
  // Request details
  subject: string; // Subject ID they want to learn
  message: string; // Student's message to tutor
  preferredSchedule?: string; // Student's preferred schedule
  expectedPrice?: number; // Student's expected price per session
  sessionDuration?: number; // Preferred session duration (minutes)
  learningMode: 'ONLINE' | 'OFFLINE' | 'FLEXIBLE'; // Preferred learning mode
  
  // Contact info
  studentContact: {
    phone?: string;
    email?: string;
    preferredContactMethod: 'phone' | 'email' | 'both';
  };
  
  // Status tracking
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  
  // Tutor response
  tutorResponse?: {
    message?: string;
    acceptedAt?: Date;
    rejectedAt?: Date;
    rejectionReason?: string;
    counterOffer?: {
      pricePerSession?: number;
      sessionDuration?: number;
      schedule?: string;
      conditions?: string;
    };
  };
  
  // Auto-expire
  expiresAt: Date; // Auto expire after 7 days if no response
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const ContactRequestSchema = new Schema<IContactRequest>(
  {
    _id: {
      type: String,
      default: uuidv4,
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

    // Initiator
    initiatedBy: {
      type: String,
      enum: ['STUDENT', 'TUTOR'],
      required: true,
      default: 'STUDENT',
    },
    
    // Request details
    subject: {
      type: String,
      required: true,
      ref: 'Subject',
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    preferredSchedule: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    expectedPrice: {
      type: Number,
      min: 50000,
      max: 10000000,
    },
    sessionDuration: {
      type: Number,
      enum: [60, 90, 120, 150, 180],
      default: 60,
    },
    learningMode: {
      type: String,
      required: true,
      enum: ['ONLINE', 'OFFLINE', 'FLEXIBLE'],
    },
    
    // Contact info
    studentContact: {
      phone: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
      },
      preferredContactMethod: {
        type: String,
        required: true,
        enum: ['phone', 'email', 'both'],
        default: 'both',
      },
    },
    
    // Status
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
      default: 'PENDING',
    },
    
    // Tutor response
    tutorResponse: {
      message: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
      acceptedAt: Date,
      rejectedAt: Date,
      rejectionReason: {
        type: String,
        enum: [
          'SCHEDULE_CONFLICT',
          'PRICE_DISAGREEMENT', 
          'STUDENT_LEVEL_MISMATCH',
          'LOCATION_ISSUE',
          'PERSONAL_REASON',
          'OTHER'
        ],
      },
      counterOffer: {
        pricePerSession: {
          type: Number,
          min: 50000,
          max: 10000000,
        },
        sessionDuration: {
          type: Number,
          enum: [60, 90, 120, 150, 180],
        },
        schedule: {
          type: String,
          maxlength: 500,
        },
        conditions: {
          type: String,
          maxlength: 500,
        },
      },
    },
    
    // Auto expire
    expiresAt: {
      type: Date,
      required: true,
      default: function() {
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      },
    },
  },
  {
    timestamps: true,
    collection: 'contact_requests',
  }
);

// Indexes
ContactRequestSchema.index({ studentId: 1, createdAt: -1 });
ContactRequestSchema.index({ tutorId: 1, createdAt: -1 });
ContactRequestSchema.index({ tutorPostId: 1 });
ContactRequestSchema.index({ status: 1 });
ContactRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Middleware to update TutorPost contactCount
ContactRequestSchema.post('save', async function(doc) {
  if (doc.isNew) {
    await model('TutorPost').findByIdAndUpdate(
      doc.tutorPostId,
      { $inc: { contactCount: 1 } }
    );
  }
});

// Transform output
ContactRequestSchema.set('toJSON', {
  transform: function(doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const ContactRequest = model<IContactRequest>('ContactRequest', ContactRequestSchema);