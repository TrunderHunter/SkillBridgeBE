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
