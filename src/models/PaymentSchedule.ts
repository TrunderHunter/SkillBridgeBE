import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IPaymentSchedule extends Document {
  _id: string;
  contractId: string; // Reference to Contract
  studentId: string; // Reference to User (Student)
  tutorId: string; // Reference to User (Tutor)

  // Payment details
  installmentNumber: number; // 1, 2, 3, etc.
  amount: number;
  dueDate: Date;

  // Status tracking
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  
  // Payment info
  paidAt?: Date;
  paidAmount?: number;
  paymentMethod?: string; // e.g., 'BANK_TRANSFER', 'CASH', 'MOMO', 'VNPAY'
  transactionId?: string;
  
  // Notes
  notes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const PaymentScheduleSchema = new Schema<IPaymentSchedule>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    contractId: {
      type: String,
      required: true,
      ref: 'Contract',
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

    // Payment details
    installmentNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: true,
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'],
      default: 'PENDING',
    },

    // Payment info
    paidAt: Date,
    paidAmount: Number,
    paymentMethod: String,
    transactionId: String,

    // Notes
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    collection: 'payment_schedules',
  }
);

// Indexes
PaymentScheduleSchema.index({ contractId: 1, installmentNumber: 1 });
PaymentScheduleSchema.index({ studentId: 1, status: 1 });
PaymentScheduleSchema.index({ tutorId: 1, status: 1 });
PaymentScheduleSchema.index({ dueDate: 1, status: 1 });

// Transform output
PaymentScheduleSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const PaymentSchedule = model<IPaymentSchedule>('PaymentSchedule', PaymentScheduleSchema);
