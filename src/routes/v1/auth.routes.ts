import { Router } from 'express';
import { authController } from '../../controllers/auth';
import {
  registerValidator,
  verifyOTPValidator,
  resendOTPValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  refreshTokenValidator,
  logoutValidator,
  registerParentValidation
} from '../../validators';
import { handleValidationErrors } from '../../middlewares';
import { body } from 'express-validator';

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
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  loginValidator,
  handleValidationErrors,
  authController.login
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

/**
 * @route   POST /api/v1/auth/otp-status
 * @desc    Get OTP status and remaining time
 * @access  Public
 */
router.post(
  '/otp-status',
  resendOTPValidator, // Using same validator as it only needs email
  handleValidationErrors,
  authController.getOTPStatus
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send password reset OTP to email
 * @access  Public
 */
router.post(
  '/forgot-password',
  forgotPasswordValidator,
  handleValidationErrors,
  authController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with OTP
 * @access  Public
 */
router.post(
  '/reset-password',
  resetPasswordValidator,
  handleValidationErrors,
  authController.resetPassword
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh-token',
  refreshTokenValidator,
  handleValidationErrors,
  authController.refreshToken
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (revoke refresh token)
 * @access  Public
 */
router.post(
  '/logout',
  logoutValidator,
  handleValidationErrors,
  authController.logout
);

/**
 * @route   POST /api/v1/auth/register/parent
 * @desc    Register a new parent
 * @access  Public
 */
router.post(
  '/register/parent',
  registerParentValidation,
  handleValidationErrors,
  authController.registerParent
);

/**
 * @route   POST /api/v1/auth/verify-parent-otp
 * @desc    Verify OTP cho đăng ký phụ huynh
 * @access  Public
 */
router.post(
  '/verify-parent-otp',
  [
    body('email')
      .isEmail()
      .withMessage('Email không hợp lệ')
      .normalizeEmail(),
    body('otp_code')
      .isLength({ min: 6, max: 6 })
      .withMessage('Mã OTP phải có 6 ký tự')
      .isNumeric()
      .withMessage('Mã OTP chỉ chứa số')
  ],
  handleValidationErrors,
  authController.verifyParentOTP
);

export { router as authRoutes };
