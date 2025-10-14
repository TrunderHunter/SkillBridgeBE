export interface CreateContactRequestInput {
  tutorPostId: string;
  subject: string;
  message: string;
  preferredSchedule?: string;
  expectedPrice?: number;
  sessionDuration?: number;
  learningMode: 'ONLINE' | 'OFFLINE' | 'FLEXIBLE';
  studentContact: {
    phone?: string;
    email?: string;
    preferredContactMethod: 'phone' | 'email' | 'both';
  };
}

export interface TutorResponseInput {
  message?: string;
  action: 'ACCEPT' | 'REJECT';
  rejectionReason?: string;
  counterOffer?: {
    pricePerSession?: number;
    sessionDuration?: number;
    schedule?: string;
    conditions?: string;
  };
}

export interface CreateLearningClassInput {
  contactRequestId: string;
  title: string;
  description?: string;
  totalSessions: number;
  schedule: {
    dayOfWeek: number[];
    startTime: string;
    endTime: string;
  };
  startDate: string;
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

export interface ContactRequestFilters {
  status?: string;
  subject?: string;
  learningMode?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}