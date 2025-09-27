# HƯỚNG DẪN API HỆ THỐNG XÁC THỰC THÔNG TIN GIA SƯ

## 📋 TỔNG QUAN HỆ THỐNG

Hệ thống quản lý và xác thực thông tin hành nghề của gia sư bao gồm 3 loại thông tin chính:

- **Education**: Trình độ học vấn (1-1 với gia sư)
- **Certificate**: Chứng chỉ (1-n với gia sư)
- **Achievement**: Thành tích (0-n với gia sư)

**Điều kiện đủ hành nghề**: Education đã xác thực + ít nhất 1 Certificate đã xác thực

---

## 🔐 XÁC THỰC

Tất cả API đều yêu cầu JWT token trong header:

```
Authorization: Bearer <JWT_TOKEN>
```

---

## 📊 CẤU TRÚC DỮ LIỆU

### **Trạng thái xác thực (VerificationStatus)**

- `PENDING`: Đang chờ xác thực
- `VERIFIED`: Đã được xác thực
- `REJECTED`: Đã bị từ chối
- `MODIFIED_PENDING`: Thông tin đã xác thực đang chờ xác thực lại sau khi sửa đổi

### **Trạng thái yêu cầu (RequestStatus)**

- `PENDING`: Đang chờ xử lý
- `APPROVED`: Được chấp nhận hoàn toàn
- `PARTIALLY_APPROVED`: Chấp nhận một phần
- `REJECTED`: Bị từ chối hoàn toàn

### **Response Format mới với Qualification Info**

```json
{
  "success": true,
  "message": "Thông báo",
  "data": {
    /* Dữ liệu chính */
  },
  "qualification": {
    "isQualified": false,
    "canSubmitVerification": true,
    "hasChangesNeedVerification": true,
    "pendingVerificationCount": 2,
    "missingRequirements": ["education"],
    "suggestion": "Bạn đã đủ điều kiện gửi yêu cầu xác thực..."
  }
}
```

---

# 🎓 API CHO GIA SƯ

## 1. TỔNG QUAN THÔNG TIN TRÌNH ĐỘ

### **GET /api/v1/tutor/qualifications**

Lấy toàn bộ thông tin trình độ của gia sư kèm gợi ý hành động.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Lấy thông tin trình độ thành công",
  "data": {
    "education": {
      "_id": "670123...",
      "level": "UNIVERSITY",
      "school": "Đại học Bách Khoa",
      "major": "Khoa học máy tính",
      "startYear": 2020,
      "endYear": 2024,
      "imgUrl": "https://res.cloudinary.com/...",
      "status": "VERIFIED",
      "verifiedAt": "2024-01-15T00:00:00.000Z"
    },
    "certificates": [
      {
        "_id": "670124...",
        "name": "TOEIC 850",
        "issuingOrganization": "ETS",
        "issueDate": "2024-01-01T00:00:00.000Z",
        "imageUrl": "https://res.cloudinary.com/...",
        "status": "VERIFIED"
      }
    ],
    "achievements": [
      {
        "_id": "670125...",
        "name": "Giải nhất Olympic Tin học",
        "level": "NATIONAL",
        "achievedDate": "2023-12-01T00:00:00.000Z",
        "awardingOrganization": "Bộ GD&ĐT",
        "type": "COMPETITION",
        "field": "Tin học",
        "status": "PENDING"
      }
    ],
    "qualificationStats": {
      "totalEducation": 1,
      "totalCertificates": 2,
      "totalAchievements": 1,
      "verifiedEducation": 1,
      "verifiedCertificates": 1,
      "verifiedAchievements": 0
    }
  },
  "qualification": {
    "isQualified": true,
    "canSubmitVerification": true,
    "hasChangesNeedVerification": true,
    "pendingVerificationCount": 1,
    "missingRequirements": [],
    "suggestion": "Bạn có 1 thông tin đã thay đổi cần xác thực. Gửi yêu cầu để duy trì trạng thái gia sư."
  }
}
```

---

## 2. QUẢN LÝ TRÌNH ĐỘ HỌC VẤN

### **POST /api/v1/tutor/education**

Tạo thông tin học vấn mới (có thể kèm ảnh).

**Headers:**

```
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**Body (FormData):**

```
level: "UNIVERSITY" (required) - HIGH_SCHOOL|COLLEGE|UNIVERSITY|MASTER|PHD
school: "Đại học Bách Khoa" (required)
major: "Khoa học máy tính" (optional)
startYear: 2020 (required)
endYear: 2024 (required)
image: [File] (optional) - Ảnh bằng cấp
```

**Response:**

```json
{
  "success": true,
  "message": "Thêm thông tin học vấn thành công",
  "data": {
    "_id": "670123...",
    "tutorId": "670100...",
    "level": "UNIVERSITY",
    "school": "Đại học Bách Khoa",
    "major": "Khoa học máy tính",
    "startYear": 2020,
    "endYear": 2024,
    "imgUrl": "https://res.cloudinary.com/skillbridge/education/670100.../image.jpg",
    "status": "PENDING",
    "createdAt": "2024-10-01T00:00:00.000Z",
    "updatedAt": "2024-10-01T00:00:00.000Z"
  },
  "qualification": {
    "isQualified": false,
    "canSubmitVerification": false,
    "hasChangesNeedVerification": true,
    "pendingVerificationCount": 1,
    "missingRequirements": ["certificate"],
    "suggestion": "Bạn cần thêm ít nhất 1 chứng chỉ để có thể gửi yêu cầu xác thực."
  }
}
```

### **PUT /api/v1/tutor/education**

Cập nhật thông tin học vấn (có thể kèm ảnh mới).

**Headers:**

```
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**Body (FormData):**

```
level: "MASTER" (optional)
school: "Đại học Quốc gia" (optional)
major: "Công nghệ thông tin" (optional)
startYear: 2020 (optional)
endYear: 2024 (optional)
image: [File] (optional) - Ảnh bằng cấp mới
```

**Response:** Tương tự POST với qualification suggestion phù hợp.

---

## 3. QUẢN LÝ CHỨNG CHỈ

### **POST /api/v1/tutor/certificates**

Tạo chứng chỉ mới (có thể kèm ảnh).

**Headers:**

```
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**Body (FormData):**

```
name: "TOEIC 850" (required)
issuingOrganization: "ETS" (required)
issueDate: "2024-01-01" (required)
expiryDate: "2026-01-01" (optional)
description: "Chứng chỉ tiếng Anh TOEIC" (optional)
image: [File] (optional) - Ảnh chứng chỉ
```

**Response:**

```json
{
  "success": true,
  "message": "Thêm chứng chỉ thành công",
  "data": {
    "_id": "670124...",
    "tutorId": "670100...",
    "name": "TOEIC 850",
    "issuingOrganization": "ETS",
    "issueDate": "2024-01-01T00:00:00.000Z",
    "expiryDate": "2026-01-01T00:00:00.000Z",
    "description": "Chứng chỉ tiếng Anh TOEIC",
    "imageUrl": "https://res.cloudinary.com/skillbridge/certificates/670100.../cert.jpg",
    "status": "PENDING",
    "createdAt": "2024-10-01T00:00:00.000Z"
  },
  "qualification": {
    "isQualified": false,
    "canSubmitVerification": true,
    "hasChangesNeedVerification": true,
    "pendingVerificationCount": 2,
    "missingRequirements": [],
    "suggestion": "Bạn đã đủ điều kiện gửi yêu cầu xác thực. Hãy gửi ngay để trở thành gia sư chính thức!"
  }
}
```

### **PUT /api/v1/tutor/certificates/:id**

Cập nhật chứng chỉ (có thể kèm ảnh mới).

**Headers:**

```
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**Body (FormData):**

```
name: "TOEIC 900" (optional)
issuingOrganization: "ETS Global" (optional)
issueDate: "2024-02-01" (optional)
expiryDate: "2026-02-01" (optional)
description: "Chứng chỉ TOEIC cập nhật" (optional)
image: [File] (optional) - Ảnh chứng chỉ mới
```

### **DELETE /api/v1/tutor/certificates/:id**

Xóa chứng chỉ.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Xóa chứng chỉ thành công"
}
```

**Lưu ý:** Không được xóa chứng chỉ cuối cùng đã VERIFIED nếu muốn duy trì trạng thái đủ hành nghề.

---

## 4. QUẢN LÝ THÀNH TÍCH

### **POST /api/v1/tutor/achievements**

Tạo thành tích mới (có thể kèm ảnh).

**Headers:**

```
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**Body (FormData):**

```
name: "Giải nhất Olympic Tin học" (required)
level: "NATIONAL" (required) - INTERNATIONAL|NATIONAL|REGIONAL|LOCAL|INSTITUTIONAL
achievedDate: "2023-12-01" (required)
awardingOrganization: "Bộ GD&ĐT" (required)
type: "COMPETITION" (required) - COMPETITION|SCHOLARSHIP|RESEARCH|PUBLICATION|OTHER
field: "Tin học" (required)
description: "Giải nhất cuộc thi Olympic Tin học sinh viên" (optional)
image: [File] (optional) - Ảnh giải thưởng
```

**Response:**

```json
{
  "success": true,
  "message": "Thêm thành tích thành công",
  "data": {
    "_id": "670125...",
    "tutorId": "670100...",
    "name": "Giải nhất Olympic Tin học",
    "level": "NATIONAL",
    "achievedDate": "2023-12-01T00:00:00.000Z",
    "awardingOrganization": "Bộ GD&ĐT",
    "type": "COMPETITION",
    "field": "Tin học",
    "description": "Giải nhất cuộc thi Olympic Tin học sinh viên",
    "imgUrl": "https://res.cloudinary.com/skillbridge/achievements/670100.../award.jpg",
    "status": "PENDING",
    "createdAt": "2024-10-01T00:00:00.000Z"
  },
  "qualification": {
    "isQualified": true,
    "canSubmitVerification": true,
    "hasChangesNeedVerification": true,
    "pendingVerificationCount": 1,
    "missingRequirements": [],
    "suggestion": "Bạn có 1 thông tin đã thay đổi cần xác thực. Gửi yêu cầu để duy trì trạng thái gia sư."
  }
}
```

### **PUT /api/v1/tutor/achievements/:id**

Cập nhật thành tích (có thể kèm ảnh mới).

### **DELETE /api/v1/tutor/achievements/:id**

Xóa thành tích.

---

## 5. QUẢN LÝ YÊU CẦU XÁC THỰC

### **POST /api/v1/tutor/verification-requests**

Gửi yêu cầu xác thực thông tin.

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <token>
```

**Body:**

```json
{
  "educationId": "670123..." // optional - ID của Education cần xác thực
  "certificateIds": ["670124...", "670125..."], // optional - Danh sách ID Certificate
  "achievementIds": ["670126..."] // optional - Danh sách ID Achievement
}
```

**Lưu ý:** Ít nhất một trong các trường trên phải được cung cấp.

**Response:**

```json
{
  "success": true,
  "message": "Tạo yêu cầu xác thực thành công",
  "data": {
    "_id": "670200...",
    "tutorId": "670100...",
    "status": "PENDING",
    "submittedAt": "2024-10-01T00:00:00.000Z",
    "details": [
      {
        "_id": "670201...",
        "targetType": "EDUCATION",
        "targetId": "670123...",
        "requestType": "NEW",
        "status": "PENDING",
        "dataSnapshot": {
          "level": "UNIVERSITY",
          "school": "Đại học Bách Khoa",
          "major": "Khoa học máy tính"
        }
      }
    ]
  }
}
```

### **GET /api/v1/tutor/verification-requests**

Xem lịch sử yêu cầu xác thực.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

```
page: 1 (optional) - Trang hiện tại
limit: 10 (optional) - Số lượng kết quả mỗi trang (1-100)
```

**Response:**

```json
{
  "success": true,
  "message": "Lấy lịch sử yêu cầu xác thực thành công",
  "data": {
    "requests": [
      {
        "_id": "670200...",
        "status": "APPROVED",
        "submittedAt": "2024-10-01T00:00:00.000Z",
        "reviewedAt": "2024-10-02T00:00:00.000Z",
        "reviewedBy": {
          "_id": "670050...",
          "fullName": "Admin User",
          "email": "admin@skillbridge.com"
        },
        "adminNote": "Thông tin hợp lệ",
        "details": [...]
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

# 👨‍💼 API CHO ADMIN

## 1. QUẢN LÝ YÊU CẦU XÁC THỰC

### **GET /api/v1/admin/verification-requests**

Lấy danh sách yêu cầu xác thực.

**Headers:**

```
Authorization: Bearer <admin_token>
```

**Query Parameters:**

```
page: 1 (optional)
limit: 10 (optional)
status: "PENDING" (optional) - PENDING|APPROVED|PARTIALLY_APPROVED|REJECTED
tutorId: "670100..." (optional) - Lọc theo ID gia sư
```

**Response:**

```json
{
  "success": true,
  "message": "Lấy danh sách yêu cầu xác thực thành công",
  "data": {
    "requests": [
      {
        "_id": "670200...",
        "tutorId": "670100...",
        "tutor": {
          "_id": "670100...",
          "fullName": "Nguyễn Văn A",
          "email": "tutor@example.com"
        },
        "status": "PENDING",
        "submittedAt": "2024-10-01T00:00:00.000Z",
        "detailsCount": 3
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 10,
      "totalPages": 2
    }
  }
}
```

### **GET /api/v1/admin/verification-requests/:id**

Xem chi tiết yêu cầu xác thực.

**Response:**

```json
{
  "success": true,
  "message": "Lấy chi tiết yêu cầu xác thực thành công",
  "data": {
    "_id": "670200...",
    "tutorId": "670100...",
    "tutor": {
      "_id": "670100...",
      "fullName": "Nguyễn Văn A",
      "email": "tutor@example.com"
    },
    "status": "PENDING",
    "submittedAt": "2024-10-01T00:00:00.000Z",
    "details": [
      {
        "_id": "670201...",
        "targetType": "EDUCATION",
        "targetId": "670123...",
        "requestType": "NEW",
        "status": "PENDING",
        "dataSnapshot": {
          "level": "UNIVERSITY",
          "school": "Đại học Bách Khoa",
          "major": "Khoa học máy tính",
          "startYear": 2020,
          "endYear": 2024,
          "imgUrl": "https://res.cloudinary.com/..."
        },
        "target": {
          "_id": "670123...",
          "level": "UNIVERSITY",
          "school": "Đại học Bách Khoa",
          "major": "Khoa học máy tính",
          "status": "PENDING"
        }
      }
    ]
  }
}
```

### **PUT /api/v1/admin/verification-requests/:id**

Xử lý yêu cầu xác thực.

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <admin_token>
```

**Body:**

```json
{
  "decisions": [
    {
      "detailId": "670201...",
      "status": "VERIFIED", // VERIFIED | REJECTED
      "rejectionReason": "Lý do từ chối" // Required nếu status = REJECTED
    },
    {
      "detailId": "670202...",
      "status": "REJECTED",
      "rejectionReason": "Thông tin không chính xác"
    }
  ],
  "adminNote": "Ghi chú của admin" // optional
}
```

**Response:**

```json
{
  "success": true,
  "message": "Xử lý yêu cầu xác thực thành công",
  "data": {
    "_id": "670200...",
    "status": "PARTIALLY_APPROVED", // Tự động tính toán dựa trên decisions
    "reviewedAt": "2024-10-02T00:00:00.000Z",
    "reviewedBy": "670050...",
    "adminNote": "Ghi chú của admin",
    "result": "Đã xử lý 2/2 mục: 1 được chấp nhận, 1 bị từ chối"
  }
}
```

### **GET /api/v1/admin/verification-history**

Xem lịch sử xác thực đã xử lý.

**Query Parameters:**

```
page: 1 (optional)
limit: 10 (optional)
tutorId: "670100..." (optional)
targetType: "EDUCATION" (optional) - EDUCATION|CERTIFICATE|ACHIEVEMENT
status: "VERIFIED" (optional) - VERIFIED|REJECTED
```

---

# 🚀 CÁC TÍNH NĂNG ĐẶC BIỆT

## 1. UPLOAD ẢNH VỚI CLOUDINARY

### **Cấu hình tự động:**

- **Size limit**: 5MB
- **Supported formats**: jpg, jpeg, png, gif, webp
- **Auto optimization**: resize (1000x1000), quality optimization, format conversion
- **Folder structure**:
  - Education: `skillbridge/education/{tutorId}/`
  - Certificate: `skillbridge/certificates/{tutorId}/`
  - Achievement: `skillbridge/achievements/{tutorId}/`

### **Cách sử dụng:**

```javascript
// Frontend example
const formData = new FormData();
formData.append('name', 'TOEIC 850');
formData.append('issuingOrganization', 'ETS');
formData.append('issueDate', '2024-01-01');
formData.append('image', imageFile); // File object

fetch('/api/v1/tutor/certificates', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    // Không set Content-Type, để browser tự set cho multipart/form-data
  },
  body: formData,
});
```

## 2. QUALIFICATION SUGGESTIONS

Mỗi response của API qualification sẽ kèm theo object `qualification` chứa:

### **Các trường hợp gợi ý:**

- **Thiếu thông tin**: "Bạn cần thêm thông tin học vấn và ít nhất 1 chứng chỉ..."
- **Đủ điều kiện lần đầu**: "Bạn đã đủ điều kiện gửi yêu cầu xác thực. Hãy gửi ngay..."
- **Có thay đổi cần xác thực**: "Bạn có 2 thông tin đã thay đổi cần xác thực..."
- **Đang xử lý**: "Bạn có yêu cầu xác thực đang được xử lý..."
- **Hoàn thành**: "Bạn đã đủ điều kiện hành nghề. Tất cả thông tin đã được xác thực."

### **Cách sử dụng trong Frontend:**

```javascript
// Check qualification status
if (response.qualification.canSubmitVerification) {
  showVerificationSuggestion(response.qualification.suggestion);
}

// Show notification badge
if (response.qualification.pendingVerificationCount > 0) {
  showBadge(response.qualification.pendingVerificationCount);
}
```

## 3. BACKUP VÀ RECOVERY SYSTEM

### **Khi sửa đổi thông tin đã VERIFIED:**

1. Thông tin cũ được backup vào field `verifiedData`
2. Status chuyển từ `VERIFIED` → `MODIFIED_PENDING`
3. Nếu không gửi yêu cầu xác thực trong 24h → Auto backup (sẽ implement sau)

### **Khi bị từ chối:**

Có thể khôi phục thông tin từ `verifiedData` nếu có.

---

# 🔍 ERROR HANDLING

## Common Error Responses

### **400 Bad Request**

```json
{
  "success": false,
  "message": "Validation error",
  "error": "Tên chứng chỉ không được để trống"
}
```

### **401 Unauthorized**

```json
{
  "success": false,
  "message": "Token không hợp lệ",
  "error": "JWT token expired"
}
```

### **403 Forbidden**

```json
{
  "success": false,
  "message": "Không có quyền truy cập",
  "error": "Admin access required"
}
```

### **404 Not Found**

```json
{
  "success": false,
  "message": "Không tìm thấy tài nguyên",
  "error": "Certificate not found"
}
```

### **500 Internal Server Error**

```json
{
  "success": false,
  "message": "Lỗi server nội bộ",
  "error": "Database connection failed"
}
```

---

# 📝 LƯU Ý QUAN TRỌNG

## 1. Business Rules

- Education: Chỉ 1 record per tutor, endYear > startYear
- Certificate: Nhiều records, expiryDate > issueDate (nếu có)
- Achievement: Nhiều records, achievedDate <= ngày hiện tại
- Không được xóa certificate cuối cùng đã VERIFIED

## 2. Workflow Xác thực

- Gia sư tạo/sửa thông tin → Status = PENDING/MODIFIED_PENDING
- Gửi yêu cầu xác thực → Tạo VerificationRequest + VerificationDetails
- Admin xử lý từng mục riêng biệt → Cập nhật status tương ứng
- Status tổng thể được tính tự động dựa trên kết quả từng mục

## 3. File Upload

- Chỉ hỗ trợ khi sử dụng `multipart/form-data`
- Image field là optional, có thể tạo/sửa thông tin mà không cần ảnh
- URL ảnh được tạo tự động và trả về trong response

## 4. Qualification Check

- Được thực hiện tự động sau mỗi thao tác
- Frontend nên dựa vào `qualification.suggestion` để hiển thị gợi ý cho user
- `canSubmitVerification: true` → Hiển thị button "Gửi yêu cầu xác thực"

---
