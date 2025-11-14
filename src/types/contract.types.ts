// Contract input types
export interface CreateContractInput {
  contactRequestId: string;
  title: string;
  description?: string;
  
  // Class details (will be taken from ContactRequest/TutorPost)
  pricePerSession: number;
  sessionDuration: number;
  totalSessions: number;
  learningMode: 'ONLINE' | 'OFFLINE';
  
  schedule: {
    dayOfWeek: number[];
    startTime: string;
    endTime: string;
    timezone?: string;
  };
  
  startDate: string | Date;
  endDate: string | Date;
  
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
  
  paymentTerms: {
    paymentMethod: 'FULL' | 'INSTALLMENT';
    installments?: number;
    downPayment?: number;
  };
  
  terms?: {
    cancellationPolicy?: string;
    refundPolicy?: string;
    makeupPolicy?: string;
    responsibilitiesOfTutor?: string;
    responsibilitiesOfStudent?: string;
    additionalTerms?: string;
  };
}

export interface UpdateContractInput {
  title?: string;
  description?: string;
  schedule?: {
    dayOfWeek?: number[];
    startTime?: string;
    endTime?: string;
  };
  startDate?: string | Date;
  endDate?: string | Date;
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
  paymentTerms?: {
    paymentMethod: 'FULL' | 'INSTALLMENT';
    installments?: number;
    downPayment?: number;
  };
  terms?: {
    cancellationPolicy?: string;
    refundPolicy?: string;
    makeupPolicy?: string;
    responsibilitiesOfTutor?: string;
    responsibilitiesOfStudent?: string;
    additionalTerms?: string;
  };
}

export interface SignContractInput {
  contractId: string;
  signatureData?: string; // Base64 encoded signature or hash
  ipAddress?: string;
}

export interface ContractFilters {
  status?: 'DRAFT' | 'PENDING_STUDENT' | 'PENDING_TUTOR' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  startDate?: string;
  endDate?: string;
}

// Payment schedule types
export interface CreatePaymentScheduleInput {
  contractId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string | Date;
}

export interface UpdatePaymentInput {
  paymentMethod: string;
  transactionId?: string;
  paidAmount?: number;
  notes?: string;
}

export interface PaymentScheduleFilters {
  status?: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  fromDate?: string;
  toDate?: string;
}
