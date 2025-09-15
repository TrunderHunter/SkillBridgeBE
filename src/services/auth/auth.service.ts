import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, OTP, RefreshToken } from '../../models';
import { emailService } from '../email';
import {
  IUserInput,
  IUserResponse,
  UserStatus,
  ILoginInput,
  ILoginResponse,
  ITokenResponse,
  OTPType,
  IForgotPasswordInput,
  IResetPasswordInput,
  IRefreshTokenInput,
} from '../../types';
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

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: ILoginResponse;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    otpSent: boolean;
  };
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  message: string;
  data?: ITokenResponse;
}

export interface OTPStatusResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    remainingSeconds: number;
    expiresAt: Date;
    canResend: boolean;
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
    const expiresIn = process.env.JWT_EXPIRE || '15m'; // Shorter access token

    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private async createTokens(
    userId: string,
    email: string
  ): Promise<ITokenResponse> {
    const accessToken = this.generateJWT(userId, email);
    const refreshToken = this.generateRefreshToken();

    // Save refresh token to database
    const refreshTokenDoc = new RefreshToken({
      user_id: userId,
      token: refreshToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    await refreshTokenDoc.save();

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 15 * 60, // 15 minutes in seconds
    };
  }

  private async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
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
      await OTP.deleteMany({
        email: userData.email,
        otp_type: OTPType.REGISTRATION,
      });

      const otpRecord = new OTP({
        email: userData.email,
        otp_code: otpCode,
        otp_type: OTPType.REGISTRATION,
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
        otp_type: OTPType.REGISTRATION,
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

      // Check if there's a recent OTP and enforce cooldown
      const recentOTP = await OTP.findOne({
        email,
        otp_type: OTPType.REGISTRATION,
        expires_at: { $gt: new Date() },
      }).sort({ created_at: -1 });

      if (recentOTP) {
        const now = new Date();
        const createdAt = recentOTP.created_at
          ? new Date(recentOTP.created_at)
          : now;
        const timeSinceCreation = now.getTime() - createdAt.getTime();
        const cooldownPeriod = 60 * 1000; // 1 minute cooldown

        if (timeSinceCreation < cooldownPeriod) {
          const remainingCooldown = Math.ceil(
            (cooldownPeriod - timeSinceCreation) / 1000
          );
          return {
            success: false,
            message: `Vui lòng đợi ${remainingCooldown} giây trước khi gửi lại mã OTP`,
          };
        }
      }

      // Generate new OTP
      const otpCode = this.generateOTP();

      // Remove old OTP
      await OTP.deleteMany({ email, otp_type: OTPType.REGISTRATION });

      // Create new OTP
      const otpRecord = new OTP({
        email,
        otp_code: otpCode,
        otp_type: OTPType.REGISTRATION,
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

  async getOTPStatus(
    email: string,
    otpType: OTPType = OTPType.REGISTRATION
  ): Promise<OTPStatusResponse> {
    try {
      // Find the most recent valid OTP for this email and type
      const otpRecord = await OTP.findOne({
        email,
        is_used: false,
        otp_type: otpType,
        expires_at: { $gt: new Date() },
      }).sort({ created_at: -1 });

      if (!otpRecord) {
        return {
          success: false,
          message: 'Không có mã OTP hợp lệ',
        };
      }

      const now = new Date();
      const expiresAt = new Date(otpRecord.expires_at);
      const remainingMs = expiresAt.getTime() - now.getTime();
      const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

      // Allow resend if less than 9 minutes remaining (1 minute cooldown after OTP creation)
      const createdAt = otpRecord.created_at
        ? new Date(otpRecord.created_at)
        : now;
      const timeSinceCreation = now.getTime() - createdAt.getTime();
      const cooldownPeriod = 60 * 1000; // 1 minute cooldown
      const canResend = timeSinceCreation >= cooldownPeriod;

      return {
        success: true,
        message: 'Trạng thái OTP',
        data: {
          email,
          remainingSeconds,
          expiresAt,
          canResend,
        },
      };
    } catch (error) {
      logger.error('Get OTP status failed:', error);
      return {
        success: false,
        message: 'Không thể lấy trạng thái OTP',
      };
    }
  }

  async login(loginData: ILoginInput): Promise<LoginResponse> {
    try {
      const { email, password } = loginData;

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return {
          success: false,
          message: 'Email hoặc mật khẩu không chính xác',
        };
      }

      // Check if user is active
      if (user.status !== UserStatus.ACTIVE) {
        if (user.status === UserStatus.PENDING_VERIFICATION) {
          return {
            success: false,
            message:
              'Tài khoản chưa được xác thực. Vui lòng kiểm tra email để xác thực tài khoản.',
          };
        } else if (user.status === UserStatus.LOCKED) {
          return {
            success: false,
            message: 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.',
          };
        }
      }

      // Verify password
      const isPasswordValid = await this.comparePassword(
        password,
        user.password_hash
      );
      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Email hoặc mật khẩu không chính xác',
        };
      }

      // Revoke old refresh tokens (optional - for security)
      await RefreshToken.updateMany(
        { user_id: user._id, is_revoked: false },
        { is_revoked: true }
      );

      // Generate tokens
      const tokens = await this.createTokens(user._id, user.email);

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

      logger.info(`User logged in successfully: ${email}`);

      return {
        success: true,
        message: 'Đăng nhập thành công',
        data: {
          user: userResponse,
          tokens,
        },
      };
    } catch (error) {
      logger.error('Login failed:', error);
      return {
        success: false,
        message: 'Đăng nhập thất bại. Vui lòng thử lại sau.',
      };
    }
  }

  async forgotPassword(
    data: IForgotPasswordInput
  ): Promise<ForgotPasswordResponse> {
    try {
      const { email } = data;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        // Return error when email doesn't exist
        return {
          success: false,
          message:
            'Email này không tồn tại trong hệ thống. Vui lòng kiểm tra lại email.',
        };
      }

      if (user.status !== UserStatus.ACTIVE) {
        return {
          success: false,
          message:
            'Tài khoản chưa được xác thực, không thể sử dụng chức năng này',
        };
      }

      // Check if there's a recent password reset OTP and enforce cooldown
      const recentOTP = await OTP.findOne({
        email,
        otp_type: OTPType.PASSWORD_RESET,
        expires_at: { $gt: new Date() },
      }).sort({ created_at: -1 });

      if (recentOTP) {
        const now = new Date();
        const createdAt = recentOTP.created_at
          ? new Date(recentOTP.created_at)
          : now;
        const timeSinceCreation = now.getTime() - createdAt.getTime();
        const cooldownPeriod = 60 * 1000; // 1 minute cooldown

        if (timeSinceCreation < cooldownPeriod) {
          const remainingCooldown = Math.ceil(
            (cooldownPeriod - timeSinceCreation) / 1000
          );
          return {
            success: false,
            message: `Vui lòng đợi ${remainingCooldown} giây trước khi gửi lại mã OTP`,
          };
        }
      }

      // Generate OTP
      const otpCode = this.generateOTP();

      // Remove old password reset OTPs
      await OTP.deleteMany({
        email,
        otp_type: OTPType.PASSWORD_RESET,
      });

      // Create new OTP
      const otpRecord = new OTP({
        email,
        otp_code: otpCode,
        otp_type: OTPType.PASSWORD_RESET,
      });

      await otpRecord.save();

      // Send password reset email
      const emailSent = await emailService.sendPasswordResetOTP(
        email,
        otpCode,
        user.full_name
      );

      if (!emailSent) {
        return {
          success: false,
          message: 'Không thể gửi email. Vui lòng thử lại sau.',
        };
      }

      logger.info(`Password reset OTP sent: ${email}`);

      return {
        success: true,
        message: 'Mã OTP đặt lại mật khẩu đã được gửi đến email của bạn.',
        data: {
          email,
          otpSent: true,
        },
      };
    } catch (error) {
      logger.error('Forgot password failed:', error);
      return {
        success: false,
        message: 'Gửi mã OTP thất bại. Vui lòng thử lại sau.',
      };
    }
  }

  async resetPassword(
    data: IResetPasswordInput
  ): Promise<ResetPasswordResponse> {
    try {
      const { email, otp_code, new_password } = data;

      // Find valid OTP
      const otpRecord = await OTP.findOne({
        email,
        otp_code,
        is_used: false,
        otp_type: OTPType.PASSWORD_RESET,
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

      // Hash new password
      const hashedPassword = await this.hashPassword(new_password);

      // Update user password
      user.password_hash = hashedPassword;
      await user.save();

      // Mark OTP as used
      otpRecord.is_used = true;
      await otpRecord.save();

      // Revoke all refresh tokens for security
      await RefreshToken.updateMany(
        { user_id: user._id },
        { is_revoked: true }
      );

      logger.info(`Password reset successfully: ${email}`);

      return {
        success: true,
        message:
          'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
      };
    } catch (error) {
      logger.error('Reset password failed:', error);
      return {
        success: false,
        message: 'Đặt lại mật khẩu thất bại. Vui lòng thử lại sau.',
      };
    }
  }

  async refreshToken(data: IRefreshTokenInput): Promise<RefreshTokenResponse> {
    try {
      const { refresh_token } = data;

      // Find refresh token
      const refreshTokenDoc = await RefreshToken.findOne({
        token: refresh_token,
        is_revoked: false,
        expires_at: { $gt: new Date() },
      });

      if (!refreshTokenDoc) {
        return {
          success: false,
          message: 'Refresh token không hợp lệ hoặc đã hết hạn',
        };
      }

      // Find user
      const user = await User.findById(refreshTokenDoc.user_id);
      if (!user || user.status !== UserStatus.ACTIVE) {
        return {
          success: false,
          message: 'Người dùng không hợp lệ',
        };
      }

      // Revoke old refresh token
      refreshTokenDoc.is_revoked = true;
      await refreshTokenDoc.save();

      // Generate new tokens
      const tokens = await this.createTokens(user._id, user.email);

      logger.info(`Token refreshed successfully: ${user.email}`);

      return {
        success: true,
        message: 'Làm mới token thành công',
        data: tokens,
      };
    } catch (error) {
      logger.error('Refresh token failed:', error);
      return {
        success: false,
        message: 'Làm mới token thất bại. Vui lòng đăng nhập lại.',
      };
    }
  }

  async logout(refreshToken: string): Promise<ResetPasswordResponse> {
    try {
      // Revoke refresh token
      await RefreshToken.updateOne(
        { token: refreshToken },
        { is_revoked: true }
      );

      return {
        success: true,
        message: 'Đăng xuất thành công',
      };
    } catch (error) {
      logger.error('Logout failed:', error);
      return {
        success: false,
        message: 'Đăng xuất thất bại',
      };
    }
  }
}

export const authService = new AuthService();
