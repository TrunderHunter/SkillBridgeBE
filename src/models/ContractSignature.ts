import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum SignatureStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export interface IContractSignatureRecord {
  _id?: string;
  contract_id: string;
  signer_id: string; // userId who signed (student or tutor)
  signer_role: 'student' | 'tutor';
  email: string; // Email where OTP was sent
  otp_hash: string; // Hashed OTP for audit trail (never store plain OTP)
  ip_address?: string; // IP address of signer for legal proof
  user_agent?: string; // Browser/device info for audit
  signed_at: Date; // Timestamp when signature was verified
  consent_text: string; // The exact consent text user agreed to
  verification_attempts: number; // Number of OTP verification attempts
  status: SignatureStatus;
  created_at?: Date;
  updated_at?: Date;
}

export interface IContractSignatureDocument
  extends IContractSignatureRecord,
    Document {
  _id: string;
}

const contractSignatureSchema = new Schema<IContractSignatureDocument>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    contract_id: {
      type: String,
      required: [true, 'Contract ID is required'],
      ref: 'Contract',
      index: true,
    },
    signer_id: {
      type: String,
      required: [true, 'Signer ID is required'],
      ref: 'User',
      index: true,
    },
    signer_role: {
      type: String,
      required: [true, 'Signer role is required'],
      enum: ['student', 'tutor'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    otp_hash: {
      type: String,
      required: [true, 'OTP hash is required'],
    },
    ip_address: {
      type: String,
      required: false,
    },
    user_agent: {
      type: String,
      required: false,
    },
    signed_at: {
      type: Date,
      required: [true, 'Signature timestamp is required'],
      default: Date.now,
    },
    consent_text: {
      type: String,
      required: [true, 'Consent text is required'],
    },
    verification_attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(SignatureStatus),
      default: SignatureStatus.PENDING,
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  }
);

// Compound index for finding signatures by contract and role
contractSignatureSchema.index({ contract_id: 1, signer_role: 1 });

// Index for finding signatures by signer
contractSignatureSchema.index({ signer_id: 1, created_at: -1 });

export const ContractSignature = mongoose.model<IContractSignatureDocument>(
  'ContractSignature',
  contractSignatureSchema
);
