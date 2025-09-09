import { Request, Response } from 'express';
import { authService } from '../../services/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { IUserInput } from '../../types';
import { logger } from '../../utils/logger';

export interface RegisterRequest extends Request {
  body: IUserInput;
}

export interface VerifyOTPRequest extends Request {
  body: {
    email: string;
    otp_code: string;
  };
}

export interface ResendOTPRequest extends Request {
  body: {
    email: string;
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
}

export const authController = new AuthController();
