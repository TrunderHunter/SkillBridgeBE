import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Payment Model
 * Tracks individual payment transactions for learning class sessions
 * Links to PaymentSchedule for overall payment tracking
 */

export interface IPayment extends Document {
  _id: string;
  paymentScheduleId: string;
  contractId: string;
  learningClassId: string;
  studentId: string;
  tutorId: string;

  // Payment details
  orderId: string; // Unique order ID for VNPay (vnp_TxnRef)
  amount: number; // Total payment amount
  paymentType: 'SINGLE_WEEK' | 'MULTI_WEEK' | 'FULL_REMAINING'; // Payment flexibility
  sessionNumbers: number[]; // Which sessions this payment covers

  // Payment gateway info
  paymentMethod: 'VNPAY' | 'BANK_TRANSFER' | 'CASH';
  paymentGateway?: 'VNPAY';
  gatewayTransactionId?: string; // vnp_TransactionNo from VNPay
  gatewayResponseCode?: string; // vnp_ResponseCode
  gatewayBankCode?: string; // vnp_BankCode
  gatewayCardType?: string; // vnp_CardType

  // Status tracking
  status:
    | 'PENDING'
    | 'COMPLETED'
    | 'FAILED'
    | 'EXPIRED'
    | 'REFUNDED'
    | 'CANCELLED';

  // Timestamps
  createdAt: Date;
  paidAt?: Date;
  expiredAt?: Date;
  refundedAt?: Date;

  // Additional info
  description?: string;
  ipAddress?: string;
  userAgent?: string;

  // Proof of payment (for manual bank transfer)
  proofOfPayment?: {
    screenshotUrl?: string;
    uploadedAt?: Date;
    verifiedBy?: string; // Admin user ID
    verifiedAt?: Date;
  };

  // Gateway raw response (for debugging)
  gatewayRawResponse?: any;

  // Refund info
  refundInfo?: {
    reason?: string;
    amount?: number;
    refundedBy?: string; // Admin user ID
    refundedAt?: Date;
  };
}

const PaymentSchema = new Schema<IPayment>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    paymentScheduleId: {
      type: String,
      ref: 'PaymentSchedule',
      required: true,
      index: true,
    },
    contractId: {
      type: String,
      ref: 'Contract',
      required: true,
      index: true,
    },
    learningClassId: {
      type: String,
      ref: 'LearningClass',
      required: true,
      index: true,
    },
    studentId: {
      type: String,
      ref: 'User',
      required: true,
      index: true,
    },
    tutorId: {
      type: String,
      ref: 'User',
      required: true,
      index: true,
    },

    // Payment details
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentType: {
      type: String,
      enum: ['SINGLE_WEEK', 'MULTI_WEEK', 'FULL_REMAINING'],
      required: true,
    },
    sessionNumbers: {
      type: [Number],
      required: true,
      validate: {
        validator: function (arr: number[]) {
          return arr.length > 0;
        },
        message: 'Phải có ít nhất một buổi học',
      },
    },

    // Payment method (VNPAY only)
    paymentMethod: {
      type: String,
      enum: ['VNPAY'],
      required: true,
      default: 'VNPAY',
    },
    paymentGateway: {
      type: String,
      enum: ['VNPAY'],
    },
    gatewayTransactionId: {
      type: String,
      index: true,
      sparse: true,
    },
    gatewayResponseCode: String,
    gatewayBankCode: String,
    gatewayCardType: String,

    // Status
    status: {
      type: String,
      enum: [
        'PENDING',
        'COMPLETED',
        'FAILED',
        'EXPIRED',
        'REFUNDED',
        'CANCELLED',
      ],
      default: 'PENDING',
      required: true,
      index: true,
    },

    // Timestamps
    paidAt: Date,
    expiredAt: Date,
    refundedAt: Date,

    // Additional
    description: String,
    ipAddress: String,
    userAgent: String,

    // Proof of payment
    proofOfPayment: {
      screenshotUrl: String,
      uploadedAt: Date,
      verifiedBy: {
        type: String,
        ref: 'User',
      },
      verifiedAt: Date,
    },

    // Gateway response
    gatewayRawResponse: Schema.Types.Mixed,

    // Refund
    refundInfo: {
      reason: String,
      amount: Number,
      refundedBy: {
        type: String,
        ref: 'User',
      },
      refundedAt: Date,
    },
  },
  {
    timestamps: true,
    collection: 'payments',
  }
);

// Indexes for efficient queries
PaymentSchema.index({ studentId: 1, status: 1 });
PaymentSchema.index({ tutorId: 1, status: 1 });
PaymentSchema.index({ createdAt: -1 });
PaymentSchema.index({ paidAt: -1 });

// Set expiration time for pending payments (30 minutes)
PaymentSchema.pre('save', function (next) {
  if (this.isNew && this.status === 'PENDING' && !this.expiredAt) {
    this.expiredAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }
  next();
});

// Transform output
PaymentSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
