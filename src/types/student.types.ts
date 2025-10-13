import { Document } from 'mongoose';
import { Gender } from './user.types';

export interface IStudentProfile {
  user_id: string;
  learning_goals?: string;
  preferred_subjects?: string[];
  learning_style?: 'visual' | 'auditory' | 'kinesthetic' | 'reading_writing';
  availability_schedule?: string;
  budget_range?: {
    min?: number;
    max?: number;
  };
  interests?: string;
  special_needs?: string;
  parent_contact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  status: 'draft' | 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

export interface IStudentProfileDocument extends IStudentProfile, Document {}

export interface IStudentProfileInput {
  learning_goals?: string;
  preferred_subjects?: string[];
  learning_style?: 'visual' | 'auditory' | 'kinesthetic' | 'reading_writing';
  availability_schedule?: string;
  budget_range?: {
    min?: number;
    max?: number;
  };
  interests?: string;
  special_needs?: string;
  parent_contact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
}

export interface StudentPersonalInfoInput {
  full_name?: string;
  phone_number?: string;
  gender?: Gender;
  date_of_birth?: string;
  address?: string;
  avatar_url?: string;
  structured_address?: {
    province_code?: string;
    district_code?: string;
    ward_code?: string;
    detail_address?: string;
  };
}