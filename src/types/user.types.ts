import { VerificationStatus } from './verification.types';

export enum UserRole {
  USER = 'USER',
  STUDENT = 'STUDENT',
  TUTOR = 'TUTOR',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export interface IStructuredAddress {
  province_code?: string;
  district_code?: string;
  ward_code?: string;
  detail_address?: string;
}

export interface IStructuredAddressWithInfo extends IStructuredAddress {
  province_info?: any;
  district_info?: any;
  ward_info?: any;
}

export interface IUser {
  _id?: string;
  full_name: string;
  email: string;
  password_hash: string;
  phone_number?: string;
  avatar_url?: string;
  gender?: Gender;
  date_of_birth?: Date;
  address?: string;
  structured_address?: IStructuredAddress;
  role: UserRole;
  status: UserStatus;
  created_at?: Date;
  updated_at?: Date;
}

export interface IUserInput {
  full_name: string;
  email: string;
  password: string;
  phone_number?: string;
  role?: UserRole;
}

export interface IUserResponse {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  avatar_url?: string;
  gender?: Gender;
  date_of_birth?: Date;
  address?: string;
  structured_address?: IStructuredAddress;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

export interface IOTPRecord {
  _id?: string;
  email: string;
  otp_code: string;
  expires_at: Date;
  is_used: boolean;
  otp_type: OTPType;
  created_at?: Date;
}

export enum OTPType {
  REGISTRATION = 'registration',
  PASSWORD_RESET = 'password_reset',
}

export interface ILoginInput {
  email: string;
  password: string;
}

export interface ITokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ILoginResponse {
  user: IUserResponse;
  tokens: ITokenResponse;
}

export interface IForgotPasswordInput {
  email: string;
}

export interface IResetPasswordInput {
  email: string;
  otp_code: string;
  new_password: string;
}

export interface IRefreshTokenInput {
  refresh_token: string;
}

export interface IRefreshToken {
  _id?: string;
  user_id: string;
  token: string;
  expires_at: Date;
  is_revoked: boolean;
  created_at?: Date;
}

// Tutor Profile Types
export interface ITutorProfile {
  _id?: string;
  user_id: string;
  headline?: string;
  introduction?: string;
  teaching_experience?: string;
  student_levels?: string;
  video_intro_link?: string;
  cccd_images: string[];
  // Trạng thái xác thực
  status?: VerificationStatus;
  rejection_reason?: string;
  verified_at?: Date;
  verified_by?: string;
  verified_data?: any;
  // AI Vector fields
  profileVector?: number[];
  vectorUpdatedAt?: Date;
  // Rating fields
  ratingAverage?: number;
  ratingCount?: number;
  ratingSum?: number;
  lastReviewAt?: Date | null;
  badges?: string[];
  created_at?: Date;
  updated_at?: Date;
}

export interface ITutorProfileInput {
  headline?: string;
  introduction?: string;
  teaching_experience?: string;
  student_levels?: string;
  video_intro_link?: string;
}

export interface ITutorProfileResponse {
  id: string;
  user_id: string;
  headline?: string;
  introduction?: string;
  teaching_experience?: string;
  student_levels?: string;
  video_intro_link?: string;
  cccd_images: string[];
  // Trạng thái xác thực
  status?: VerificationStatus;
  rejection_reason?: string;
  verified_at?: Date;
  verified_by?: string;
  ratingAverage?: number;
  ratingCount?: number;
  lastReviewAt?: Date | null;
  badges?: string[];
  created_at: Date;
  updated_at: Date;
}
