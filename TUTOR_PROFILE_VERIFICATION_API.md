# Tutor Profile Verification API Documentation

## Tổng quan

Tài liệu này mô tả các API endpoints mới được thêm vào để hỗ trợ quy trình xác thực thông tin gia sư (TutorProfile). Hệ thống cho phép gia sư gửi yêu cầu xác thực thông tin cá nhân và admin có thể xem xét, chấp nhận hoặc từ chối các yêu cầu này.

## Cấu trúc dữ liệu

### VerificationStatus Enum

```typescript
enum VerificationStatus {
  DRAFT = 'DRAFT', // Nháp, chưa gửi xác thực
  PENDING = 'PENDING', // Đang chờ admin xem xét
  VERIFIED = 'VERIFIED', // Đã được xác thực
  REJECTED = 'REJECTED', // Bị từ chối
  MODIFIED_PENDING = 'MODIFIED_PENDING', // Đã chỉnh sửa, chờ xác thực lại
  MODIFIED_AFTER_REJECTION = 'MODIFIED_AFTER_REJECTION', // Đã chỉnh sửa sau khi bị từ chối
}
```

### VerificationTargetType Enum

```typescript
enum VerificationTargetType {
  EDUCATION = 'EDUCATION',
  CERTIFICATE = 'CERTIFICATE',
  ACHIEVEMENT = 'ACHIEVEMENT',
  TUTOR_PROFILE = 'TUTOR_PROFILE', // Mới thêm
}
```

### TutorProfile Interface

```typescript
interface ITutorProfile {
  _id?: string;
  user_id: string;
  headline?: string;
  introduction?: string;
  teaching_experience?: string;
  student_levels?: string;
  video_intro_link?: string;
  cccd_images: string[];
  // Trạng thái xác thực
  status?: VerificationStatus;
  rejection_reason?: string;
  verified_at?: Date;
  verified_by?: string;
  verified_data?: any; // Backup dữ liệu đã xác thực
  created_at?: Date;
  updated_at?: Date;
}
```

## API Endpoints

### 1. Tutor Profile APIs

#### 1.1. Kiểm tra trạng thái có thể chỉnh sửa

**Endpoint:** `GET /api/tutor/profile/check-edit-status`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Kiểm tra trạng thái thành công",
  "data": {
    "canEdit": true,
    "status": "VERIFIED",
    "warning": "Thông tin gia sư đã được xác thực. Mọi thay đổi sẽ cần gửi yêu cầu xác thực cho admin.",
    "message": null
  }
}
```

**Các trường hợp response:**

- `canEdit: true, warning: null` - Có thể chỉnh sửa bình thường (DRAFT, REJECTED, MODIFIED_AFTER_REJECTION)
- `canEdit: true, warning: "..."` - Có thể chỉnh sửa nhưng cần cảnh báo (VERIFIED)
- `canEdit: false` - Không thể chỉnh sửa (PENDING, MODIFIED_PENDING)

#### 1.2. Gửi yêu cầu xác thực thông tin gia sư

**Endpoint:** `POST /api/tutor/profile/submit-verification`

**Headers:**

```
Authorization: Bearer <token>
```

**Response thành công:**

```json
{
  "success": true,
  "message": "Gửi yêu cầu xác thực thành công",
  "data": {
    "requestId": "64f8b2c1a1b2c3d4e5f67890",
    "status": "PENDING",
    "submittedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response lỗi:**

```json
{
  "success": false,
  "message": "Đã có yêu cầu xác thực thông tin gia sư đang chờ xử lý",
  "data": {
    "errorType": "PENDING_REQUEST",
    "canRetry": false
  }
}
```

**Các loại lỗi:**

- `PENDING_REQUEST` (409) - Đã có request đang pending
- `NOT_FOUND` (404) - Không tìm thấy thông tin gia sư
- `ACCESS_DENIED` (403) - Không có quyền truy cập
- `INTERNAL_ERROR` (500) - Lỗi hệ thống

#### 1.3. Cập nhật thông tin cá nhân (có validation)

**Endpoint:** `PUT /api/tutor/profile/personal`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body:**

```
full_name: string (optional)
phone_number: string (optional)
gender: "MALE" | "FEMALE" | "OTHER" (optional)
date_of_birth: string (optional, ISO date)
address: string (optional)
structured_address: object (optional)
avatar_url: file (optional)
```

**Response khi có cảnh báo:**

```json
{
  "success": false,
  "message": "Thông tin gia sư đã được xác thực. Mọi thay đổi sẽ cần gửi yêu cầu xác thực cho admin.",
  "data": {
    "status": "VERIFIED",
    "canEdit": true,
    "warning": "Thông tin gia sư đã được xác thực. Mọi thay đổi sẽ cần gửi yêu cầu xác thực cho admin.",
    "requiresConfirmation": true
  }
}
```

**Response khi bị chặn:**

```json
{
  "success": false,
  "message": "Thông tin gia sư đang chờ xác thực, không thể chỉnh sửa",
  "data": {
    "status": "PENDING",
    "canEdit": false
  }
}
```

#### 1.4. Cập nhật thông tin giới thiệu (có validation)

**Endpoint:** `PUT /api/tutor/profile/introduction`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{
  "headline": "string (optional)",
  "introduction": "string (optional)",
  "teaching_experience": "string (optional)",
  "student_levels": "string (optional)",
  "video_intro_link": "string (optional)"
}
```

**Response:** Tương tự như cập nhật thông tin cá nhân

### 2. Admin Verification APIs

#### 2.1. Lấy chi tiết yêu cầu xác thực (bao gồm User và TutorProfile)

**Endpoint:** `GET /api/admin/verification-requests/:id`

**Headers:**

```
Authorization: Bearer <admin_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Lấy chi tiết yêu cầu xác thực thành công",
  "data": {
    "request": {
      "_id": "64f8b2c1a1b2c3d4e5f67890",
      "tutorId": {
        "_id": "64f8b2c1a1b2c3d4e5f67891",
        "fullName": "Nguyễn Văn A",
        "email": "nguyenvana@email.com",
        "phoneNumber": "0123456789"
      },
      "status": "PENDING",
      "submittedAt": "2024-01-15T10:30:00.000Z",
      "reviewedAt": null,
      "reviewedBy": null,
      "adminNote": null
    },
    "details": [
      {
        "_id": "64f8b2c1a1b2c3d4e5f67892",
        "requestId": "64f8b2c1a1b2c3d4e5f67890",
        "targetType": "TUTOR_PROFILE",
        "targetId": "64f8b2c1a1b2c3d4e5f67893",
        "requestType": "NEW",
        "dataSnapshot": {
          "headline": "Gia sư Toán Lý Hóa",
          "introduction": "Tôi có 5 năm kinh nghiệm...",
          "teaching_experience": "5 năm",
          "student_levels": "THPT",
          "video_intro_link": "https://youtube.com/...",
          "cccd_images": ["https://cloudinary.com/..."]
        },
        "target": {
          "_id": "64f8b2c1a1b2c3d4e5f67893",
          "user_id": "64f8b2c1a1b2c3d4e5f67891",
          "headline": "Gia sư Toán Lý Hóa",
          "introduction": "Tôi có 5 năm kinh nghiệm...",
          "teaching_experience": "5 năm",
          "student_levels": "THPT",
          "video_intro_link": "https://youtube.com/...",
          "cccd_images": ["https://cloudinary.com/..."],
          "status": "PENDING",
          "userInfo": {
            "_id": "64f8b2c1a1b2c3d4e5f67891",
            "fullName": "Nguyễn Văn A",
            "email": "nguyenvana@email.com",
            "phoneNumber": "0123456789",
            "gender": "MALE",
            "dateOfBirth": "1990-01-01T00:00:00.000Z",
            "address": "123 Đường ABC, Quận 1, TP.HCM",
            "structured_address": {
              "province_code": "79",
              "district_code": "760",
              "ward_code": "26734",
              "province_info": {
                "name": "Thành phố Hồ Chí Minh",
                "code": "79"
              },
              "district_info": {
                "name": "Quận 1",
                "code": "760"
              },
              "ward_info": {
                "name": "Phường Bến Nghé",
                "code": "26734"
              }
            },
            "avatar_url": "https://cloudinary.com/avatar.jpg"
          }
        }
      }
    ]
  }
}
```

#### 2.2. Lấy thông tin User và TutorProfile

**Endpoint:** `GET /api/admin/verification-requests/:tutorId/user-info`

**Headers:**

```
Authorization: Bearer <admin_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Lấy thông tin người dùng và gia sư thành công",
  "data": {
    "user": {
      "_id": "64f8b2c1a1b2c3d4e5f67891",
      "fullName": "Nguyễn Văn A",
      "email": "nguyenvana@email.com",
      "phoneNumber": "0123456789",
      "gender": "MALE",
      "dateOfBirth": "1990-01-01T00:00:00.000Z",
      "address": "123 Đường ABC, Quận 1, TP.HCM",
      "structured_address": {
        "province_code": "79",
        "district_code": "760",
        "ward_code": "26734",
        "province_info": {
          "name": "Thành phố Hồ Chí Minh",
          "code": "79"
        },
        "district_info": {
          "name": "Quận 1",
          "code": "760"
        },
        "ward_info": {
          "name": "Phường Bến Nghé",
          "code": "26734"
        }
      },
      "avatar_url": "https://cloudinary.com/avatar.jpg"
    },
    "tutorProfile": {
      "_id": "64f8b2c1a1b2c3d4e5f67893",
      "user_id": "64f8b2c1a1b2c3d4e5f67891",
      "headline": "Gia sư Toán Lý Hóa",
      "introduction": "Tôi có 5 năm kinh nghiệm...",
      "teaching_experience": "5 năm",
      "student_levels": "THPT",
      "video_intro_link": "https://youtube.com/...",
      "cccd_images": ["https://cloudinary.com/..."],
      "status": "PENDING",
      "rejection_reason": null,
      "verified_at": null,
      "verified_by": null,
      "verified_data": null
    }
  }
}
```

#### 2.3. Xử lý yêu cầu xác thực (chấp nhận/từ chối)

**Endpoint:** `PUT /api/admin/verification-requests/:id`

**Headers:**

```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Body:**

```json
{
  "decisions": [
    {
      "detailId": "64f8b2c1a1b2c3d4e5f67892",
      "status": "VERIFIED"
    },
    {
      "detailId": "64f8b2c1a1b2c3d4e5f67893",
      "status": "REJECTED",
      "rejectionReason": "Thông tin không đầy đủ, vui lòng bổ sung thêm"
    }
  ],
  "adminNote": "Ghi chú của admin (optional)"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Xử lý yêu cầu xác thực thành công",
  "data": {
    "requestId": "64f8b2c1a1b2c3d4e5f67890",
    "status": "COMPLETED",
    "processedAt": "2024-01-15T11:00:00.000Z",
    "decisions": [
      {
        "detailId": "64f8b2c1a1b2c3d4e5f67892",
        "status": "VERIFIED"
      },
      {
        "detailId": "64f8b2c1a1b2c3d4e5f67893",
        "status": "REJECTED",
        "rejectionReason": "Thông tin không đầy đủ, vui lòng bổ sung thêm"
      }
    ]
  }
}
```

## Workflow chi tiết

### 1. Quy trình từ phía Tutor

#### Bước 1: Tạo/Chỉnh sửa thông tin

1. Tutor truy cập trang profile
2. Hệ thống gọi `GET /api/tutor/profile/check-edit-status`
3. Nếu `canEdit: true` và có `warning`, hiển thị modal cảnh báo
4. Tutor xác nhận và thực hiện chỉnh sửa
5. Gọi `PUT /api/tutor/profile/personal` hoặc `PUT /api/tutor/profile/introduction`

#### Bước 2: Gửi yêu cầu xác thực

1. Tutor nhấn nút "Gửi xác thực"
2. Hệ thống gọi `POST /api/tutor/profile/submit-verification`
3. Nếu thành công, trạng thái chuyển từ DRAFT → PENDING
4. Hiển thị thông báo thành công

#### Bước 3: Theo dõi trạng thái

1. Tutor có thể xem trạng thái verification trong profile
2. Nếu bị từ chối, hiển thị lý do từ chối
3. Có thể chỉnh sửa và gửi lại

### 2. Quy trình từ phía Admin

#### Bước 1: Xem danh sách yêu cầu

1. Admin truy cập trang quản lý verification
2. Gọi `GET /api/admin/verification-requests` để lấy danh sách
3. Hiển thị các yêu cầu đang PENDING

#### Bước 2: Xem chi tiết yêu cầu

1. Admin click vào một yêu cầu
2. Gọi `GET /api/admin/verification-requests/:id`
3. Hiển thị thông tin chi tiết bao gồm:
   - Thông tin User (tên, email, số điện thoại, địa chỉ)
   - Thông tin TutorProfile (headline, introduction, experience, etc.)
   - Ảnh CCCD
   - Video giới thiệu

#### Bước 3: Xử lý yêu cầu

1. Admin xem xét thông tin
2. Chấp nhận hoặc từ chối từng mục
3. Gọi `PUT /api/admin/verification-requests/:id`
4. Hệ thống cập nhật trạng thái và gửi thông báo

## Xử lý lỗi

### Các mã lỗi phổ biến

#### 400 - Bad Request

```json
{
  "success": false,
  "message": "Dữ liệu không hợp lệ",
  "error": "Validation error details"
}
```

#### 401 - Unauthorized

```json
{
  "success": false,
  "message": "Người dùng chưa được xác thực",
  "error": "Token không hợp lệ hoặc đã hết hạn"
}
```

#### 403 - Forbidden

```json
{
  "success": false,
  "message": "Không có quyền truy cập",
  "data": {
    "canEdit": false,
    "status": "PENDING"
  }
}
```

#### 404 - Not Found

```json
{
  "success": false,
  "message": "Không tìm thấy thông tin gia sư",
  "data": {
    "errorType": "NOT_FOUND",
    "canRetry": false
  }
}
```

#### 409 - Conflict

```json
{
  "success": false,
  "message": "Đã có yêu cầu xác thực thông tin gia sư đang chờ xử lý",
  "data": {
    "errorType": "PENDING_REQUEST",
    "canRetry": false
  }
}
```

#### 500 - Internal Server Error

```json
{
  "success": false,
  "message": "Gửi yêu cầu xác thực thất bại. Vui lòng thử lại sau.",
  "data": {
    "errorType": "INTERNAL_ERROR",
    "canRetry": true
  }
}
```

## Lưu ý quan trọng

### 1. Trạng thái Verification

- **DRAFT**: Thông tin chưa được gửi xác thực, có thể chỉnh sửa tự do
- **PENDING**: Đang chờ admin xem xét, không thể chỉnh sửa
- **VERIFIED**: Đã được xác thực, có thể chỉnh sửa nhưng cần cảnh báo
- **REJECTED**: Bị từ chối, có thể chỉnh sửa và gửi lại
- **MODIFIED_PENDING**: Đã chỉnh sửa thông tin đã xác thực, chờ xác thực lại
- **MODIFIED_AFTER_REJECTION**: Đã chỉnh sửa sau khi bị từ chối

### 2. Backup và Restore

- Khi thông tin VERIFIED được chỉnh sửa, hệ thống tự động backup vào `verified_data`
- Nếu admin từ chối, hệ thống tự động restore từ `verified_data`
- Nếu admin chấp nhận, `verified_data` được xóa

### 3. Độc lập với Qualifications

- Verification request cho TutorProfile hoàn toàn độc lập với Education, Certificate, Achievement
- Có thể có nhiều request PENDING cùng lúc cho các loại thông tin khác nhau

### 4. Security

- Tất cả endpoints đều yêu cầu authentication
- Admin endpoints yêu cầu role admin
- Validation đầy đủ cho tất cả input data

## Testing

### Test Cases cơ bản

#### 1. Tutor Profile Verification

```bash
# 1. Kiểm tra trạng thái chỉnh sửa
curl -X GET "http://localhost:3000/api/tutor/profile/check-edit-status" \
  -H "Authorization: Bearer <tutor_token>"

# 2. Gửi yêu cầu xác thực
curl -X POST "http://localhost:3000/api/tutor/profile/submit-verification" \
  -H "Authorization: Bearer <tutor_token>"

# 3. Cập nhật thông tin (có validation)
curl -X PUT "http://localhost:3000/api/tutor/profile/personal" \
  -H "Authorization: Bearer <tutor_token>" \
  -F "full_name=Nguyễn Văn A" \
  -F "phone_number=0123456789"
```

#### 2. Admin Verification

```bash
# 1. Lấy danh sách yêu cầu
curl -X GET "http://localhost:3000/api/admin/verification-requests" \
  -H "Authorization: Bearer <admin_token>"

# 2. Lấy chi tiết yêu cầu
curl -X GET "http://localhost:3000/api/admin/verification-requests/64f8b2c1a1b2c3d4e5f67890" \
  -H "Authorization: Bearer <admin_token>"

# 3. Xử lý yêu cầu
curl -X PUT "http://localhost:3000/api/admin/verification-requests/64f8b2c1a1b2c3d4e5f67890" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "decisions": [
      {
        "detailId": "64f8b2c1a1b2c3d4e5f67892",
        "status": "VERIFIED"
      }
    ],
    "adminNote": "Thông tin đầy đủ và chính xác"
  }'
```

---

**Tài liệu này cung cấp hướng dẫn đầy đủ để sử dụng các API mới cho quy trình xác thực thông tin gia sư. Mọi thắc mắc vui lòng liên hệ team phát triển.**
