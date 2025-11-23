export interface CreateContractInput {
  contactRequestId: string;
  title: string;
  description?: string;
  subject?: string; // Optional - will be taken from tutorPost if not provided
  totalSessions: number;
  pricePerSession?: number; // Optional - will be taken from contact request if not provided
  totalAmount?: number; // Optional - will be calculated if not provided
  sessionDuration?: number; // Optional - will be taken from contact request if not provided
  learningMode?: 'ONLINE' | 'OFFLINE'; // Optional - will be determined from contact request
  schedule: {
    dayOfWeek: number[];
    startTime: string;
    endTime: string;
  };
  startDate: string; // ISO date string
  location?: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  onlineInfo?: {
    platform: 'ZOOM' | 'GOOGLE_MEET' | 'MICROSOFT_TEAMS' | 'OTHER';
    meetingLink?: string;
    meetingId?: string;
    password?: string;
  };
}

export interface StudentContractResponse {
  action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
  message?: string;
  requestedChanges?: string;
}

export interface ContractFilters {
  status?:
  | 'DRAFT'
  | 'PENDING_STUDENT_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';
  studentId?: string;
  tutorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface CreatePaymentScheduleInput {
  contractId: string;
  paymentMethod: 'FULL_PAYMENT' | 'INSTALLMENTS';
  installmentPlan?: {
    numberOfInstallments?: number;
    firstPaymentPercentage?: number;
  };
  paymentTerms?: {
    lateFeePercentage?: number;
    gracePeriodDays?: number;
    cancellationPolicy?: {
      refundPercentage?: number;
      minimumNoticeDays?: number;
    };
  };
}

export interface ProcessPaymentInput {
  paymentScheduleId: string;
  installmentNumber: number;
  amount: number;
  paymentMethod: 'BANK_TRANSFER' | 'CREDIT_CARD' | 'E_WALLET' | 'CASH';
  transactionId?: string;
  notes?: string;
}

export interface ContractSummary {
  id: string;
  title: string;
  status: string;
  totalAmount: number;
  totalSessions: number;
  studentName: string;
  tutorName: string;
  createdAt: Date;
  expiresAt?: Date;
  approvedAt?: Date;
}

export interface PaymentScheduleSummary {
  id: string;
  contractId: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  nextPaymentDue?: Date;
  nextPaymentAmount?: number;
}
