# SkillBridge Authentication API

## Tổng quan

API xác thực cho ứng dụng SkillBridge với chức năng đăng ký người dùng và xác thực OTP qua email.

## Cấu trúc User Model

### Bảng Users

- `id` (UUID, Primary Key)
- `full_name` (VARCHAR, NOT NULL) - Họ tên đầy đủ
- `email` (VARCHAR, NOT NULL, UNIQUE) - Email
- `password_hash` (VARCHAR, NOT NULL) - Mật khẩu đã hash
- `phone_number` (VARCHAR, UNIQUE) - Số điện thoại
- `avatar_url` (VARCHAR) - URL ảnh đại diện
- `role` (ENUM, NOT NULL) - Vai trò người dùng
- `status` (ENUM, NOT NULL, DEFAULT: 'pending_verification') - Trạng thái tài khoản
- `created_at` (TIMESTAMP) - Thời gian tạo
- `updated_at` (TIMESTAMP) - Thời gian cập nhật

### User Roles

- `user` - Người dùng mặc định
- `student` - Học viên
- `tutor` - Gia sư
- `admin` - Quản trị viên

### User Status

- `active` - Đang hoạt động
- `locked` - Bị khóa
- `pending_verification` - Chờ xác thực email

## API Endpoints

### 1. Đăng ký tài khoản

**POST** `/api/v1/auth/register`

#### Request Body:

```json
{
  "full_name": "Nguyễn Văn A",
  "email": "user@example.com",
  "password": "Password123",
  "phone_number": "0123456789" // optional
}
```

#### Validation:

- `full_name`: 2-100 ký tự, chỉ chứa chữ cái và khoảng trắng
- `email`: Email hợp lệ, tối đa 255 ký tự
- `password`: 6-128 ký tự, phải chứa ít nhất 1 chữ thường, 1 chữ hoa và 1 số
- `phone_number`: Số điện thoại Việt Nam hợp lệ (optional)

#### Response Success (201):

```json
{
  "success": true,
  "message": "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.",
  "data": {
    "email": "user@example.com",
    "otpSent": true
  }
}
```

#### Response Error (400):

```json
{
  "success": false,
  "message": "Email đã được sử dụng bởi tài khoản khác"
}
```

### 2. Xác thực OTP

**POST** `/api/v1/auth/verify-otp`

#### Request Body:

```json
{
  "email": "user@example.com",
  "otp_code": "123456"
}
```

#### Response Success (200):

```json
{
  "success": true,
  "message": "Xác thực thành công",
  "data": {
    "user": {
      "id": "uuid-string",
      "full_name": "Nguyễn Văn A",
      "email": "user@example.com",
      "phone_number": "0123456789",
      "avatar_url": null,
      "role": "user",
      "status": "active",
      "created_at": "2025-09-08T10:00:00.000Z",
      "updated_at": "2025-09-08T10:00:00.000Z"
    },
    "token": "jwt-token-string"
  }
}
```

#### Response Error (400):

```json
{
  "success": false,
  "message": "Mã OTP không hợp lệ hoặc đã hết hạn"
}
```

### 3. Gửi lại OTP

**POST** `/api/v1/auth/resend-otp`

#### Request Body:

```json
{
  "email": "user@example.com"
}
```

#### Response Success (200):

```json
{
  "success": true,
  "message": "Mã OTP mới đã được gửi đến email của bạn.",
  "data": {
    "email": "user@example.com",
    "otpSent": true
  }
}
```

## Cấu hình Email

Cần cấu hình các biến môi trường sau trong file `.env`:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Hướng dẫn cấu hình Gmail:

1. Bật 2-Factor Authentication cho tài khoản Gmail
2. Tạo App Password: https://myaccount.google.com/apppasswords
3. Sử dụng App Password làm `SMTP_PASS`

## Tính năng Token System

### Access Token & Refresh Token

- **Access Token**: JWT với thời gian hết hạn ngắn (15 phút) để bảo mật cao
- **Refresh Token**: Token dài hạn (7 ngày) để làm mới access token
- **Auto-revoke**: Khi logout hoặc đổi mật khẩu, tất cả refresh token sẽ bị thu hồi

### OTP Types

- **REGISTRATION**: OTP cho việc đăng ký tài khoản mới
- **PASSWORD_RESET**: OTP cho việc đặt lại mật khẩu

## Tính năng OTP

- OTP có 6 chữ số
- Thời gian hết hạn: 5 phút
- Tự động xóa OTP đã hết hạn khỏi database
- Một email chỉ có thể có 1 OTP active tại một thời điểm
- OTP chỉ có thể sử dụng 1 lần

## Security Features

- Mật khẩu được hash bằng bcrypt với salt rounds = 12
- JWT token với thời gian hết hạn có thể cấu hình
- Validation nghiêm ngặt cho tất cả input
- Rate limiting để chống spam
- Email verification bắt buộc trước khi kích hoạt tài khoản

## Error Handling

- Validation errors trả về status 400 với chi tiết lỗi
- Server errors trả về status 500 với thông báo generic
- Logging chi tiết cho debugging
- Response format nhất quán

## Testing

Có thể test API bằng các tools như Postman hoặc curl:

```bash
# Đăng ký tài khoản
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Nguyễn Văn A",
    "email": "test@example.com",
    "password": "Password123"
  }'

# Xác thực OTP
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp_code": "123456"
  }'
```
