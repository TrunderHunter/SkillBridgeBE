import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Evidence item (image, video, document)
export interface IReportEvidence {
  url: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  fileName?: string;
  uploadedAt: Date;
}

// Reporter information
export interface IReporterInfo {
  userId: string;
  role: 'STUDENT' | 'TUTOR';
  userName: string;
}

// Resolution details
export interface IReportResolution {
  resolvedBy: string; // Admin user ID
  resolverName: string;
  decision:
    | 'STUDENT_FAULT'
    | 'TUTOR_FAULT'
    | 'BOTH_FAULT'
    | 'NO_FAULT'
    | 'DISMISSED';
  message: string;
  resolvedAt: Date;
  notifiedAt?: Date;
  violatorUserIds?: string[]; // User IDs of violators (for BOTH_FAULT case)
}

// Admin notes for tracking investigation
export interface IAdminNote {
  _id: string;
  adminId: string;
  adminName: string;
  note: string;
  createdAt: Date;
}

// Main SessionReport interface
export interface ISessionReport extends Document {
  _id: string;
  classId: string;
  sessionNumber: number;
  reportedBy: IReporterInfo;
  reportedAgainst: 'STUDENT' | 'TUTOR'; // The role being reported
  description: string;
  evidence: IReportEvidence[];
  status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  resolution?: IReportResolution;
  adminNotes: IAdminNote[];
  violatorUserIds?: string[]; // Cached violator user IDs for quick query
  createdAt: Date;
  updatedAt: Date;
}

const reportEvidenceSchema = new Schema<IReportEvidence>(
  {
    url: { type: String, required: true },
    type: {
      type: String,
      enum: ['IMAGE', 'VIDEO', 'DOCUMENT'],
      required: true,
    },
    fileName: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reporterInfoSchema = new Schema<IReporterInfo>(
  {
    userId: { type: String, required: true },
    role: { type: String, enum: ['STUDENT', 'TUTOR'], required: true },
    userName: { type: String, required: true },
  },
  { _id: false }
);

const reportResolutionSchema = new Schema<IReportResolution>(
  {
    resolvedBy: { type: String, required: true },
    resolverName: { type: String, required: true },
    decision: {
      type: String,
      enum: [
        'STUDENT_FAULT',
        'TUTOR_FAULT',
        'BOTH_FAULT',
        'NO_FAULT',
        'DISMISSED',
      ],
      required: true,
    },
    message: { type: String, required: true },
    resolvedAt: { type: Date, required: true },
    notifiedAt: { type: Date },
    violatorUserIds: { type: [String], default: [] },
  },
  { _id: false }
);

const adminNoteSchema = new Schema<IAdminNote>({
  _id: { type: String, default: uuidv4 },
  adminId: { type: String, required: true },
  adminName: { type: String, required: true },
  note: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const sessionReportSchema = new Schema<ISessionReport>(
  {
    _id: { type: String, default: uuidv4 },
    classId: { type: String, required: true, index: true },
    sessionNumber: { type: Number, required: true },
    reportedBy: { type: reporterInfoSchema, required: true },
    reportedAgainst: {
      type: String,
      enum: ['STUDENT', 'TUTOR'],
      required: true,
    },
    description: { type: String, required: true, maxlength: 2000 },
    evidence: { type: [reportEvidenceSchema], default: [] },
    status: {
      type: String,
      enum: ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'],
      default: 'PENDING',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true,
    },
    resolution: { type: reportResolutionSchema },
    adminNotes: { type: [adminNoteSchema], default: [] },
    violatorUserIds: { type: [String], default: [], index: true },
  },
  {
    timestamps: true,
    collection: 'session_reports',
  }
);

// Indexes for efficient querying
sessionReportSchema.index({ classId: 1, sessionNumber: 1 });
sessionReportSchema.index({ 'reportedBy.userId': 1 });
sessionReportSchema.index({ violatorUserIds: 1 }); // Index for violation counting
sessionReportSchema.index({ status: 1, priority: -1, createdAt: -1 });
sessionReportSchema.index({ createdAt: -1 });

// Compound index to enforce one report per session per user
sessionReportSchema.index(
  { classId: 1, sessionNumber: 1, 'reportedBy.userId': 1 },
  { unique: true }
);

const SessionReport = model<ISessionReport>(
  'SessionReport',
  sessionReportSchema
);

export default SessionReport;
