import { Request, Response } from 'express';
import { authService } from '../../services/auth';
import { sendSuccess, sendError } from '../../utils/response';
import {
  IUserInput,
  ILoginInput,
  IForgotPasswordInput,
  IResetPasswordInput,
  IRefreshTokenInput,
  OTPType,
} from '../../types';
import { logger } from '../../utils/logger';

export interface RegisterRequest extends Request {
  body: IUserInput;
}

export interface LoginRequest extends Request {
  body: ILoginInput;
}

export interface VerifyOTPRequest extends Request {
  body: {
    email: string;
    otp_code: string;
  };
}

export interface ForgotPasswordRequest extends Request {
  body: IForgotPasswordInput;
}

export interface ResetPasswordRequest extends Request {
  body: IResetPasswordInput;
}

export interface RefreshTokenRequest extends Request {
  body: IRefreshTokenInput;
}

export interface LogoutRequest extends Request {
  body: {
    refresh_token: string;
  };
}

export interface ResendOTPRequest extends Request {
  body: {
    email: string;
  };
}

export interface OTPStatusRequest extends Request {
  body: {
    email: string;
    otp_type?: string;
  };
}

class AuthController {
  async register(req: RegisterRequest, res: Response): Promise<void> {
    try {
      const userData: IUserInput = req.body;

      logger.info(`Registration attempt for email: ${userData.email}`);

      const result = await authService.register(userData);

      if (result.success) {
        sendSuccess(res, result.message, result.data, 201);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error) {
      logger.error('Registration controller error:', error);
      sendError(res, 'Đăng ký thất bại. Vui lòng thử lại sau.', undefined, 500);
    }
  }

  async login(req: LoginRequest, res: Response): Promise<void> {
    try {
      const loginData: ILoginInput = req.body;

      logger.info(`Login attempt for email: ${loginData.email}`);

      const result = await authService.login(loginData);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 401);
      }
    } catch (error) {
      logger.error('Login controller error:', error);
      sendError(
        res,
        'Đăng nhập thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }

  async verifyOTP(req: VerifyOTPRequest, res: Response): Promise<void> {
    try {
      const { email, otp_code } = req.body;

      logger.info(`OTP verification attempt for email: ${email}`);

      const result = await authService.verifyOTP(email, otp_code);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error) {
      logger.error('OTP verification controller error:', error);
      sendError(
        res,
        'Xác thực thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }

  async resendOTP(req: ResendOTPRequest, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      logger.info(`Resend OTP attempt for email: ${email}`);

      const result = await authService.resendOTP(email);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error) {
      logger.error('Resend OTP controller error:', error);
      sendError(
        res,
        'Gửi lại mã OTP thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }

  async getOTPStatus(req: OTPStatusRequest, res: Response): Promise<void> {
    try {
      const { email, otp_type } = req.body;

      logger.info(
        `Get OTP status for email: ${email}, type: ${otp_type || 'REGISTRATION'}`
      );

      // Default to REGISTRATION if not specified
      const otpTypeEnum =
        otp_type === 'PASSWORD_RESET'
          ? OTPType.PASSWORD_RESET
          : OTPType.REGISTRATION;

      const result = await authService.getOTPStatus(email, otpTypeEnum);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error) {
      logger.error('Get OTP status controller error:', error);
      sendError(res, 'Không thể lấy trạng thái OTP.', undefined, 500);
    }
  }

  async forgotPassword(
    req: ForgotPasswordRequest,
    res: Response
  ): Promise<void> {
    try {
      const data: IForgotPasswordInput = req.body;

      logger.info(`Forgot password attempt for email: ${data.email}`);

      const result = await authService.forgotPassword(data);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error) {
      logger.error('Forgot password controller error:', error);
      sendError(
        res,
        'Yêu cầu đặt lại mật khẩu thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }

  async resetPassword(req: ResetPasswordRequest, res: Response): Promise<void> {
    try {
      const data: IResetPasswordInput = req.body;

      logger.info(`Reset password attempt for email: ${data.email}`);

      const result = await authService.resetPassword(data);

      if (result.success) {
        sendSuccess(res, result.message);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error) {
      logger.error('Reset password controller error:', error);
      sendError(
        res,
        'Đặt lại mật khẩu thất bại. Vui lòng thử lại sau.',
        undefined,
        500
      );
    }
  }

  async refreshToken(req: RefreshTokenRequest, res: Response): Promise<void> {
    try {
      const data: IRefreshTokenInput = req.body;

      logger.info('Refresh token attempt');

      const result = await authService.refreshToken(data);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 401);
      }
    } catch (error) {
      logger.error('Refresh token controller error:', error);
      sendError(
        res,
        'Làm mới token thất bại. Vui lòng đăng nhập lại.',
        undefined,
        500
      );
    }
  }

  async logout(req: LogoutRequest, res: Response): Promise<void> {
    try {
      const { refresh_token } = req.body;

      logger.info('Logout attempt');

      const result = await authService.logout(refresh_token);

      if (result.success) {
        sendSuccess(res, result.message);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error) {
      logger.error('Logout controller error:', error);
      sendError(res, 'Đăng xuất thất bại.', undefined, 500);
    }
  }
}

export const authController = new AuthController();
