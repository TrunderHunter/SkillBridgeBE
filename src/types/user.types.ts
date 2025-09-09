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

export interface IUser {
  _id?: string;
  full_name: string;
  email: string;
  password_hash: string;
  phone_number?: string;
  avatar_url?: string;
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
  created_at?: Date;
}
