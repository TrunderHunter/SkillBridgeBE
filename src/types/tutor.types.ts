import { Request } from 'express';
import { Gender, ITutorProfileInput } from './user.types';

// Tutor Profile Service Interfaces
export interface ITutorProfileService {
  getProfile(userId: string): Promise<TutorProfileResponse>;
  updatePersonalInfo(
    userId: string,
    personalInfo: PersonalInfoInput,
    avatarFile?: Express.Multer.File
  ): Promise<UpdatePersonalInfoResponse>;
  updateIntroduction(
    userId: string,
    tutorProfileData: ITutorProfileInput
  ): Promise<UpdateIntroductionResponse>;
}

export interface ICCCDService {
  uploadImages(
    userId: string,
    files: Express.Multer.File[]
  ): Promise<CCCDUploadResponse>;
  deleteImage(userId: string, imageUrl: string): Promise<CCCDDeleteResponse>;
  getImages(userId: string): Promise<CCCDGetResponse>;
  validateImageCount(userId: string, newImagesCount: number): Promise<boolean>;
}

// Service Response Interfaces
export interface TutorProfileResponse {
  success: boolean;
  message: string;
  data?: {
    user: any;
    profile: any;
  };
}

export interface UpdatePersonalInfoResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface UpdateIntroductionResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface CCCDUploadResponse {
  success: boolean;
  message: string;
  data?: {
    cccd_images: string[];
    uploaded_count: number;
  };
}

export interface CCCDDeleteResponse {
  success: boolean;
  message: string;
  data?: {
    cccd_images: string[];
  };
}

export interface CCCDGetResponse {
  success: boolean;
  message: string;
  data?: {
    cccd_images: string[];
  };
}

// Input Interfaces
export interface PersonalInfoInput {
  full_name?: string;
  phone_number?: string;
  gender?: Gender;
  date_of_birth?: string;
  address?: string;
}

// Request Interfaces for Controllers
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

// Tutor-specific types for validation
export interface TutorValidation {
  headline: {
    maxLength: number;
  };
  introduction: {
    maxLength: number;
  };
  teaching_experience: {
    maxLength: number;
  };
  student_levels: {
    maxLength: number;
  };
  cccd_images: {
    maxCount: number;
  };
}

export const TUTOR_VALIDATION_RULES: TutorValidation = {
  headline: {
    maxLength: 150,
  },
  introduction: {
    maxLength: 2000,
  },
  teaching_experience: {
    maxLength: 1000,
  },
  student_levels: {
    maxLength: 500,
  },
  cccd_images: {
    maxCount: 10,
  },
};
