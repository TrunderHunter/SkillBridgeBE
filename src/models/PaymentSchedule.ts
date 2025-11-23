import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IPaymentInstallment {
  installmentNumber: number;
  sessionNumber: number; // Which session/week this payment is for
  amount: number;
  dueDate: Date;
  status: 'UNPAID' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt?: Date;
  paymentMethod?:
    | 'VNPAY'
    | 'BANK_TRANSFER'
    | 'CREDIT_CARD'
    | 'E_WALLET'
    | 'CASH';
  paymentId?: string; // Reference to Payment document
  transactionId?: string;
  notes?: string;
}

export interface IPaymentSchedule extends Document {
  _id: string;
  contractId: string; // Reference to Contract
  learningClassId?: string; // Reference to LearningClass (set after class creation)
  studentId: string; // Reference to User (Student)
  tutorId: string; // Reference to User (Tutor)

  // Payment overview
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: 'FULL_PAYMENT' | 'INSTALLMENTS';

  // Payment schedule
  installments: IPaymentInstallment[];

  // Status tracking
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';

  // Payment terms
  paymentTerms: {
    lateFeePercentage: number; // e.g., 5 for 5% late fee per week
    gracePeriodDays: number; // Grace period before applying late fees
    cancellationPolicy: {
      refundPercentage: number; // Refund percentage based on cancellation timing
      minimumNoticeDays: number; // Minimum notice required for cancellation
    };
  };

  // Important dates
  firstPaymentDueDate: Date;
  lastPaymentDueDate: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Completion tracking
  completedAt?: Date;
  cancelledAt?: Date;

  // Methods
  checkOverduePayments(): boolean;
}

const PaymentInstallmentSchema = new Schema<IPaymentInstallment>(
  {
    installmentNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    sessionNumber: {
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
    status: {
      type: String,
      required: true,
      enum: ['UNPAID', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED'],
      default: 'UNPAID',
    },
    paidAt: Date,
    paymentMethod: {
      type: String,
      enum: ['VNPAY'],
    },
    paymentId: {
      type: String,
      ref: 'Payment',
    },
    transactionId: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

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
    learningClassId: {
      type: String,
      ref: 'LearningClass',
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

    // Payment overview
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['FULL_PAYMENT', 'INSTALLMENTS'],
    },

    // Installments
    installments: [PaymentInstallmentSchema],

    // Status
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'OVERDUE'],
      default: 'PENDING',
    },

    // Payment terms
    paymentTerms: {
      lateFeePercentage: {
        type: Number,
        default: 5,
        min: 0,
        max: 50,
      },
      gracePeriodDays: {
        type: Number,
        default: 3,
        min: 0,
        max: 30,
      },
      cancellationPolicy: {
        refundPercentage: {
          type: Number,
          default: 80,
          min: 0,
          max: 100,
        },
        minimumNoticeDays: {
          type: Number,
          default: 7,
          min: 1,
          max: 30,
        },
      },
    },

    // Important dates
    firstPaymentDueDate: {
      type: Date,
      required: true,
    },
    lastPaymentDueDate: {
      type: Date,
      required: true,
    },

    // Completion tracking
    completedAt: Date,
    cancelledAt: Date,
  },
  {
    timestamps: true,
    collection: 'payment_schedules',
  }
);

// Drop old index if exists (for migration)
PaymentScheduleSchema.pre('init', function () {
  // This will run when model is first initialized
  const collection =
    this.collection || this.db?.collection('payment_schedules');
  if (collection) {
    collection.dropIndex('scheduleId_1').catch(() => {
      // Ignore if index doesn't exist
    });
  }
});

// Indexes
PaymentScheduleSchema.index({ studentId: 1, status: 1, createdAt: -1 });
PaymentScheduleSchema.index({ tutorId: 1, status: 1, createdAt: -1 });
PaymentScheduleSchema.index({ contractId: 1 });
PaymentScheduleSchema.index({ learningClassId: 1 });
PaymentScheduleSchema.index({ status: 1, 'installments.dueDate': 1 });
PaymentScheduleSchema.index({
  'installments.status': 1,
  'installments.dueDate': 1,
});

// Pre-save middleware to calculate remaining amount
PaymentScheduleSchema.pre('save', function (next) {
  // Always calculate remaining amount if not set or if amounts changed
  if (
    this.isModified('paidAmount') ||
    this.isModified('totalAmount') ||
    !this.remainingAmount
  ) {
    this.remainingAmount = this.totalAmount - (this.paidAmount || 0);
  }

  // Update status based on payment completion
  if (this.remainingAmount <= 0 && this.status !== 'COMPLETED') {
    this.status = 'COMPLETED';
    this.completedAt = new Date();
  }

  next();
});

// Method to check for overdue payments
PaymentScheduleSchema.methods.checkOverduePayments = function () {
  const now = new Date();
  let hasOverdue = false;

  this.installments.forEach((installment: IPaymentInstallment) => {
    if (installment.status === 'UNPAID' && installment.dueDate < now) {
      installment.status = 'OVERDUE';
      hasOverdue = true;
    }
  });

  if (hasOverdue && this.status === 'ACTIVE') {
    this.status = 'OVERDUE';
  }

  return hasOverdue;
};

// Transform output
PaymentScheduleSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const PaymentSchedule = model<IPaymentSchedule>(
  'PaymentSchedule',
  PaymentScheduleSchema
);
