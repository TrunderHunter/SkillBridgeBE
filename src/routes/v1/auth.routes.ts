import { Router } from 'express';
import { authController } from '../../controllers/auth';
import {
  registerValidator,
  verifyOTPValidator,
  resendOTPValidator,
} from '../../validators';
import { handleValidationErrors } from '../../middlewares';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  registerValidator,
  handleValidationErrors,
  authController.register
);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify OTP and activate account
 * @access  Public
 */
router.post(
  '/verify-otp',
  verifyOTPValidator,
  handleValidationErrors,
  authController.verifyOTP
);

/**
 * @route   POST /api/v1/auth/resend-otp
 * @desc    Resend OTP to email
 * @access  Public
 */
router.post(
  '/resend-otp',
  resendOTPValidator,
  handleValidationErrors,
  authController.resendOTP
);

export { router as authRoutes };
