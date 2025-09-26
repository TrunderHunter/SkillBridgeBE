# SkillBridge Authentication API - Complete Guide

## Tổng quan

API xác thực hoàn chỉnh cho ứng dụng SkillBridge với các chức năng:

- ✅ Đăng ký tài khoản với OTP qua email
- ✅ Đăng nhập với JWT + Refresh Token
- ✅ Quên mật khẩu với OTP
- ✅ Làm mới token tự động
- ✅ Đăng xuất an toàn

## Cấu trúc Database

### User Model

```typescript
interface IUser {
  _id: string; // UUID
  full_name: string; // Họ tên
  email: string; // Email (unique)
  password_hash: string; // Mật khẩu đã hash
  phone_number?: string; // SĐT (optional, unique)
  avatar_url?: string; // URL ảnh đại diện
  role: UserRole; // Vai trò
  status: UserStatus; // Trạng thái
  created_at: Date;
  updated_at: Date;
}

enum UserRole {
  USER = 'user', // Mặc định
  STUDENT = 'student', // Học viên
  TUTOR = 'tutor', // Gia sư
  ADMIN = 'admin', // Quản trị
}

enum UserStatus {
  ACTIVE = 'active', // Hoạt động
  LOCKED = 'locked', // Bị khóa
  PENDING_VERIFICATION = 'pending_verification', // Chờ xác thực
}
```

### OTP Model

```typescript
interface IOTP {
  _id: string;
  email: string;
  otp_code: string; // 6 số
  expires_at: Date; // Hết hạn sau 10 phút
  is_used: boolean;
  otp_type: OTPType; // Loại OTP
}

enum OTPType {
  REGISTRATION = 'registration', // Đăng ký
  PASSWORD_RESET = 'password_reset', // Đặt lại mật khẩu
}
```

### RefreshToken Model

```typescript
interface IRefreshToken {
  _id: string;
  user_id: string; // Liên kết với User
  token: string; // Refresh token
  expires_at: Date; // Hết hạn sau 7 ngày
  is_revoked: boolean; // Đã thu hồi
}
```

## API Endpoints

### 1. Đăng ký tài khoản

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "full_name": "Nguyễn Văn A",
  "email": "user@example.com",
  "password": "Password123",
  "phone_number": "0123456789"  // optional
}
```

**Response (201):**

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

### 2. Đăng nhập

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "user": {
      "id": "uuid-string",
      "full_name": "Nguyễn Văn A",
      "email": "user@example.com",
      "phone_number": "0123456789",
      "avatar_url": null,
      "role": "user",
      "status": "active",
      "created_at": "2025-09-09T10:00:00.000Z",
      "updated_at": "2025-09-09T10:00:00.000Z"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "a1b2c3d4e5f6...",
      "expires_in": 900 // 15 phút (giây)
    }
  }
}
```

### 3. Xác thực OTP (đăng ký)

```http
POST /api/v1/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp_code": "123456"
}
```

### 4. Gửi lại OTP

```http
POST /api/v1/auth/resend-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### 5. Quên mật khẩu

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Mã OTP đặt lại mật khẩu đã được gửi đến email của bạn.",
  "data": {
    "email": "user@example.com",
    "otpSent": true
  }
}
```

### 6. Đặt lại mật khẩu

```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "otp_code": "123456",
  "new_password": "NewPassword123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới."
}
```

### 7. Làm mới Token

```http
POST /api/v1/auth/refresh-token
Content-Type: application/json

{
  "refresh_token": "a1b2c3d4e5f6..."
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Làm mới token thành công",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "new-refresh-token",
    "expires_in": 900
  }
}
```

### 8. Đăng xuất

```http
POST /api/v1/auth/logout
Content-Type: application/json

{
  "refresh_token": "a1b2c3d4e5f6..."
}
```

## Token System

### Access Token

- **Thời gian sống**: 15 phút
- **Dùng để**: Xác thực các API cần bảo mật
- **Format**: JWT với payload: `{ userId, email, iat, exp }`

### Refresh Token

- **Thời gian sống**: 7 ngày
- **Dùng để**: Làm mới access token khi hết hạn
- **Security**: Tự động thu hồi khi:
  - Người dùng đăng xuất
  - Đổi mật khẩu
  - Phát hiện hoạt động bất thường

### Token Usage Flow

```
1. Login → Nhận access_token + refresh_token
2. Gọi API → Dùng access_token trong Authorization header
3. Access token hết hạn → Dùng refresh_token để lấy token mới
4. Logout → Thu hồi refresh_token
```

## Email Templates

### OTP Đăng ký

- Subject: "SkillBridge - Mã xác thực đăng ký tài khoản"
- Template: HTML responsive với branding SkillBridge
- Thông tin: OTP 6 số, hướng dẫn sử dụng

### OTP Đặt lại mật khẩu

- Subject: "SkillBridge - Mã xác thực đặt lại mật khẩu"
- Template: HTML với cảnh báo bảo mật
- Thông tin: OTP 6 số, lưu ý bảo mật

## Validation Rules

### Đăng ký

- `full_name`: 2-100 ký tự, chỉ chữ cái và khoảng trắng
- `email`: Email hợp lệ, tối đa 255 ký tự
- `password`: 6-128 ký tự, có ít nhất 1 thường, 1 hoa, 1 số
- `phone_number`: Số VN hợp lệ (optional)

### Đăng nhập

- `email`: Email hợp lệ
- `password`: Không được trống

### OTP

- `otp_code`: Đúng 6 số
- `email`: Email hợp lệ

### Đặt lại mật khẩu

- `new_password`: Cùng rule với password đăng ký

## Security Features

1. **Password Hashing**: bcrypt với salt rounds = 12
2. **JWT Security**:
   - Access token ngắn hạn (15 phút)
   - Refresh token rotation
3. **OTP Security**:
   - 6 chữ số random
   - Hết hạn sau 10 phút
   - Chỉ sử dụng 1 lần
   - Phân loại theo mục đích
4. **Database Security**:
   - Auto-cleanup expired tokens/OTPs
   - Indexes cho performance
5. **Rate Limiting**: Chống spam và brute force
6. **Input Validation**: Strict validation cho tất cả input

## Environment Setup

```env
# Server
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/skillbridge

# JWT
JWT_SECRET=your-super-secure-jwt-secret-key
JWT_EXPIRE=15m

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Testing Examples

### curl Commands

```bash
# Đăng ký
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Nguyễn Văn A",
    "email": "test@gmail.com",
    "password": "Password123"
  }'

# Đăng nhập
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@gmail.com",
    "password": "Password123"
  }'

# Xác thực OTP
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@gmail.com",
    "otp_code": "123456"
  }'

# Quên mật khẩu
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@gmail.com"
  }'

# Đặt lại mật khẩu
curl -X POST http://localhost:3000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@gmail.com",
    "otp_code": "123456",
    "new_password": "NewPassword123"
  }'

# Làm mới token
curl -X POST http://localhost:3000/api/v1/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "your-refresh-token"
  }'

# Đăng xuất
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "your-refresh-token"
  }'
```

## Error Codes

| Status | Message                             | Description                      |
| ------ | ----------------------------------- | -------------------------------- |
| 400    | Dữ liệu không hợp lệ                | Validation errors                |
| 401    | Email hoặc mật khẩu không chính xác | Login failed                     |
| 401    | Refresh token không hợp lệ          | Token expired/invalid            |
| 400    | Mã OTP không hợp lệ hoặc đã hết hạn | OTP verification failed          |
| 400    | Email đã được sử dụng               | Registration with existing email |
| 500    | Server error                        | Internal server error            |

## Production Considerations

1. **Database Optimization**:
   - Indexes trên email, phone_number, refresh_token
   - Connection pooling
   - Read replicas cho scale

2. **Security Hardening**:
   - HTTPS only
   - Secure headers (helmet.js)
   - Rate limiting per IP
   - JWT secret rotation

3. **Monitoring**:
   - Login/registration metrics
   - Failed authentication tracking
   - Token usage analytics
   - Email delivery monitoring

4. **Performance**:
   - Redis cache cho session
   - CDN cho email templates
   - Background job cho email sending

## Troubleshooting

### Email không gửi được

- Kiểm tra SMTP settings
- Verify Gmail App Password
- Check firewall/network

### JWT Token lỗi

- Verify JWT_SECRET
- Check token expiration
- Validate token format

### Database connection

- Check MongoDB URI
- Verify network connectivity
- Check authentication credentials
