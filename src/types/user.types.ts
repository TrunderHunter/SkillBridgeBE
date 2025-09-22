import { body } from 'express-validator';


export enum UserRole {
  USER = 'USER',
  STUDENT = 'STUDENT',
  TUTOR = 'TUTOR',
  ADMIN = 'ADMIN',
  PARENT = 'PARENT',
}

export enum UserStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
  PENDING_VERIFICATION = 'pending_verification',
  DELETED = 'deleted',
}




// Validation cho đăng ký PARENT
export const registerParentValidation = [
  body('full_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên phải có từ 2-100 ký tự')
    .notEmpty()
    .withMessage('Tên là bắt buộc'),

  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail()
    .custom(async (email) => {
      // Check if email already exists
      const User = require('../../models/User').User;
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error('Email đã được sử dụng');
      }
      return true;
    }),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số'),

  body('confirm_password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Xác nhận mật khẩu không khớp');
      }
      return true;
    }),

  body('phone_number')
    .matches(/^(\+84|0)[3|5|7|8|9][0-9]{8}$/)
    .withMessage('Số điện thoại không hợp lệ (phải là số điện thoại Việt Nam)'),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Địa chỉ không được quá 500 ký tự'),

  body('terms_accepted')
    .isBoolean()
    .custom((value) => {
      if (!value) {
        throw new Error('Bạn phải đồng ý với điều khoản và chính sách');
      }
      return true;
    })
];
export interface IUser {
  _id?: string;
  full_name: string;
  email: string;
  password_hash: string;
  phone_number?: string;
  avatar_url?: string;
  role: UserRole;
  status: UserStatus;
  // Thêm các trường cho student profile
  parent_id?: string; // ID của phụ huynh
  date_of_birth?: Date;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  grade?: string;
  school?: string;
  subjects?: string[];
  learning_goals?: string; // Mục tiêu học tập
  preferred_schedule?: string; // Lịch học ưa thích
  special_requirements?: string; // Yêu cầu đặc biệt
  created_at?: Date;
  updated_at?: Date;
  password_reset_required?: boolean;
}

export interface IUserInput {
  full_name: string;
  email: string;
  password: string;
  phone_number?: string;
  role?: UserRole;
  address?: string;
}

export interface IUserResponse {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  avatar_url?: string;
  role: UserRole;
  status: UserStatus;
  parent_id?: string;
  date_of_birth?: Date;
  gender?: string;
  address?: string;
  grade?: string;
  school?: string;
  subjects?: string[];
  learning_goals?: string;
  preferred_schedule?: string;
  special_requirements?: string;
  created_at: Date;
  updated_at: Date;
}


//interface cho student profile
export interface IStudentProfileInput {
  full_name: string;
  date_of_birth?: Date;
  gender?: 'male' | 'female' | 'other';
  phone_number?: string;
  address?: string;
  grade?: string;
  school?: string;
  subjects?: string[];
  learning_goals?: string;
  preferred_schedule?: string;
  special_requirements?: string;
}



export interface IStudentProfileResponse {
  student: IUserResponse;
  temp_password?: string;
}

export interface IStudentProfileUpdateInput {
  full_name?: string;
  date_of_birth?: Date;
  gender?: 'male' | 'female' | 'other';
  phone_number?: string;
  address?: string;
  grade?: string;
  school?: string;
  subjects?: string[];
  learning_goals?: string;
  preferred_schedule?: string;
  special_requirements?: string;
}

export interface IStudentStats {
  total_students: number;
  active_students: number;
  by_grade: Array<{
    grade: string;
    count: number;
  }>;
  by_subject: Array<{
    subject: string;
    count: number;
  }>;
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


export interface IParentRegisterInput {
  full_name: string;
  email: string;
  password: string;
  phone_number: string;
  address?: string;
}

export interface IParentRegisterResponse {
  user: IUserResponse;
  tokens: ITokenResponse;
}