import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, OTP } from '../../models';
import { emailService } from '../email';
import { IUserInput, IUserResponse, UserStatus } from '../../types';
import { logger } from '../../utils/logger';

export interface RegisterResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    otpSent: boolean;
  };
}

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  data?: {
    user: IUserResponse;
    token: string;
  };
}

class AuthService {
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  private generateJWT(userId: string, email: string): string {
    const payload = { userId, email };
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const expiresIn = process.env.JWT_EXPIRE || '7d';

    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
  }

  async register(userData: IUserInput): Promise<RegisterResponse> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: userData.email },
          ...(userData.phone_number
            ? [{ phone_number: userData.phone_number }]
            : []),
        ],
      });

      if (existingUser) {
        if (existingUser.email === userData.email) {
          if (existingUser.status === UserStatus.ACTIVE) {
            return {
              success: false,
              message: 'Email đã được sử dụng bởi người dùng khác',
            };
          } else if (existingUser.status === UserStatus.PENDING_VERIFICATION) {
            // Resend OTP for pending verification
            return this.resendOTP(userData.email);
          }
        }

        if (
          userData.phone_number &&
          existingUser.phone_number === userData.phone_number
        ) {
          return {
            success: false,
            message: 'Số điện thoại đã được sử dụng bởi người dùng khác',
          };
        }
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create user with pending verification status
      const newUser = new User({
        full_name: userData.full_name,
        email: userData.email,
        password_hash: hashedPassword,
        phone_number: userData.phone_number,
        role: userData.role,
        status: UserStatus.PENDING_VERIFICATION,
      });

      await newUser.save();

      // Generate and save OTP
      const otpCode = this.generateOTP();

      // Remove old OTP for this email
      await OTP.deleteMany({ email: userData.email });

      const otpRecord = new OTP({
        email: userData.email,
        otp_code: otpCode,
      });

      await otpRecord.save();

      // Send OTP email
      const emailSent = await emailService.sendOTPEmail(
        userData.email,
        otpCode,
        userData.full_name
      );

      if (!emailSent) {
        // Rollback user creation if email fails
        await User.deleteOne({ _id: newUser._id });
        await OTP.deleteOne({ _id: otpRecord._id });

        return {
          success: false,
          message: 'Không thể gửi email xác thực. Vui lòng thử lại sau.',
        };
      }

      logger.info(`User registered successfully: ${userData.email}`);

      return {
        success: true,
        message:
          'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
        data: {
          email: userData.email,
          otpSent: true,
        },
      };
    } catch (error) {
      logger.error('Registration failed:', error);
      return {
        success: false,
        message: 'Đăng ký thất bại. Vui lòng thử lại sau.',
      };
    }
  }

  async verifyOTP(email: string, otpCode: string): Promise<VerifyOTPResponse> {
    try {
      // Find valid OTP
      const otpRecord = await OTP.findOne({
        email,
        otp_code: otpCode,
        is_used: false,
        expires_at: { $gt: new Date() },
      });

      if (!otpRecord) {
        return {
          success: false,
          message: 'Mã OTP không hợp lệ hoặc đã hết hạn',
        };
      }

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return {
          success: false,
          message: 'Không tìm thấy người dùng',
        };
      }

      // Update user status to active
      user.status = UserStatus.ACTIVE;
      await user.save();

      // Mark OTP as used
      otpRecord.is_used = true;
      await otpRecord.save();

      // Generate JWT token
      const token = this.generateJWT(user._id, user.email);

      // Prepare user response
      const userResponse: IUserResponse = {
        id: user._id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        avatar_url: user.avatar_url,
        role: user.role,
        status: user.status,
        created_at: user.created_at!,
        updated_at: user.updated_at!,
      };

      logger.info(`User verified successfully: ${email}`);

      return {
        success: true,
        message: 'Xác thực thành công',
        data: {
          user: userResponse,
          token,
        },
      };
    } catch (error) {
      logger.error('OTP verification failed:', error);
      return {
        success: false,
        message: 'Xác thực thất bại. Vui lòng thử lại sau.',
      };
    }
  }

  async resendOTP(email: string): Promise<RegisterResponse> {
    try {
      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return {
          success: false,
          message: 'Không tìm thấy người dùng với email này',
        };
      }

      if (user.status === UserStatus.ACTIVE) {
        return {
          success: false,
          message: 'Tài khoản đã được xác thực',
        };
      }

      // Generate new OTP
      const otpCode = this.generateOTP();

      // Remove old OTP
      await OTP.deleteMany({ email });

      // Create new OTP
      const otpRecord = new OTP({
        email,
        otp_code: otpCode,
      });

      await otpRecord.save();

      // Send OTP email
      const emailSent = await emailService.sendOTPEmail(
        email,
        otpCode,
        user.full_name
      );

      if (!emailSent) {
        return {
          success: false,
          message: 'Không thể gửi email xác thực. Vui lòng thử lại sau.',
        };
      }

      logger.info(`OTP resent successfully: ${email}`);

      return {
        success: true,
        message: 'Mã OTP mới đã được gửi đến email của bạn.',
        data: {
          email,
          otpSent: true,
        },
      };
    } catch (error) {
      logger.error('Resend OTP failed:', error);
      return {
        success: false,
        message: 'Gửi lại mã OTP thất bại. Vui lòng thử lại sau.',
      };
    }
  }
}

export const authService = new AuthService();
