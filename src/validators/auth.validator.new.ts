import { body, ValidationChain } from 'express-validator';

export const registerValidator: ValidationChain[] = [
  body('full_name')
    .trim()
    .notEmpty()
    .withMessage('Họ tên không được để trống')
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ tên phải từ 2 đến 100 ký tự')
    .matches(
      /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềếểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵýỷỹ\s]+$/
    )
    .withMessage('Họ tên chỉ được chứa chữ cái và khoảng trắng'),

  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Email không hợp lệ')
    .isLength({ max: 255 })
    .withMessage('Email không được quá 255 ký tự'),

  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Mật khẩu phải từ 6 đến 128 ký tự')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mật khẩu phải chứa ít nhất 1 chữ thường, 1 chữ hoa và 1 số'),

  body('phone_number')
    .optional()
    .trim()
    .matches(/^(\+84|0)[3|5|7|8|9][0-9]{8}$/)
    .withMessage('Số điện thoại không hợp lệ (định dạng Việt Nam)'),
];

export const verifyOTPValidator: ValidationChain[] = [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Email không hợp lệ'),

  body('otp_code')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Mã OTP phải có 6 ký tự')
    .isNumeric()
    .withMessage('Mã OTP chỉ được chứa số'),
];

export const loginValidator: ValidationChain[] = [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Email không hợp lệ'),

  body('password').notEmpty().withMessage('Mật khẩu không được để trống'),
];

export const forgotPasswordValidator: ValidationChain[] = [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Email không hợp lệ'),
];

export const resetPasswordValidator: ValidationChain[] = [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Email không hợp lệ'),

  body('otp_code')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Mã OTP phải có 6 ký tự')
    .isNumeric()
    .withMessage('Mã OTP chỉ được chứa số'),

  body('new_password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Mật khẩu phải từ 6 đến 128 ký tự')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mật khẩu phải chứa ít nhất 1 chữ thường, 1 chữ hoa và 1 số'),
];

export const refreshTokenValidator: ValidationChain[] = [
  body('refresh_token')
    .notEmpty()
    .withMessage('Refresh token không được để trống')
    .isLength({ min: 64, max: 256 })
    .withMessage('Refresh token không hợp lệ'),
];

export const logoutValidator: ValidationChain[] = [
  body('refresh_token')
    .notEmpty()
    .withMessage('Refresh token không được để trống'),
];

export const resendOTPValidator: ValidationChain[] = [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Email không hợp lệ'),
];
