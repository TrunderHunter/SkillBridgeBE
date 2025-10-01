# API Documentation - Subject & TutorPost APIs

## Tổng quan

Tài liệu này mô tả chi tiết các API endpoints cho:

- **Subject Management**: Quản lý môn học
- **TutorPost Management**: Quản lý bài đăng gia sư

## Base URL

```
http://localhost:5000/api/v1
```

## Authentication

Một số endpoints yêu cầu authentication token trong header:

```
Authorization: Bearer <your_jwt_token>
```

---

# Subject APIs

## 1. Public APIs (Không yêu cầu authentication)

### 1.1. Lấy danh sách môn học đang hoạt động

**GET** `/subjects/active`

**Mô tả**: Lấy tất cả môn học đang hoạt động để hiển thị cho người dùng.

**Response**:

```json
{
  "success": true,
  "message": "Active subjects retrieved successfully",
  "data": {
    "subjects": [
      {
        "_id": "67890...",
        "name": "Toán",
        "description": "Môn Toán học cơ bản và nâng cao",
        "category": "TOAN_HOC",
        "isActive": true,
        "createdAt": "2025-10-01T...",
        "updatedAt": "2025-10-01T..."
      }
    ]
  }
}
```

### 1.2. Lấy môn học theo danh mục

**GET** `/subjects/category/:category`

**Mô tả**: Lấy tất cả môn học thuộc một danh mục cụ thể.

**Parameters**:

- `category` (path): Danh mục môn học
  - `TOAN_HOC`: Toán học
  - `KHOA_HOC_TU_NHIEN`: Khoa học tự nhiên
  - `VAN_HOC_XA_HOI`: Văn học và xã hội
  - `NGOAI_NGU`: Ngoại ngữ
  - `KHAC`: Khác

**Example**: `GET /subjects/category/NGOAI_NGU`

**Response**: Tương tự API 1.1

### 1.3. Tìm kiếm môn học

**GET** `/subjects/search?q={search_term}`

**Mô tả**: Tìm kiếm môn học theo tên hoặc mô tả.

**Query Parameters**:

- `q` (required): Từ khóa tìm kiếm (1-100 ký tự)

**Example**: `GET /subjects/search?q=tiếng anh`

### 1.4. Lấy chi tiết môn học

**GET** `/subjects/:id`

**Parameters**:

- `id` (path): ID của môn học (MongoDB ObjectId)

---

## 2. Admin APIs (Yêu cầu ADMIN role)

### 2.1. Tạo môn học mới

**POST** `/subjects`

**Headers**: `Authorization: Bearer <admin_token>`

**Request Body**:

```json
{
  "name": "Tiếng Pháp",
  "description": "Tiếng Pháp cơ bản và nâng cao",
  "category": "NGOAI_NGU"
}
```

**Validation Rules**:

- `name`: Bắt buộc, tối đa 100 ký tự, duy nhất
- `description`: Tùy chọn, tối đa 500 ký tự
- `category`: Bắt buộc, phải là một trong các giá trị enum

### 2.2. Lấy tất cả môn học (có phân trang)

**GET** `/subjects`

**Headers**: `Authorization: Bearer <admin_token>`

**Query Parameters**:

- `category` (optional): Lọc theo danh mục
- `isActive` (optional): `true`/`false` - Lọc theo trạng thái
- `search` (optional): Tìm kiếm trong name và description
- `page` (optional): Số trang (mặc định: 1)
- `limit` (optional): Số item/trang (1-100, mặc định: 50)

**Example**: `GET /subjects?category=NGOAI_NGU&page=1&limit=10`

**Response**:

```json
{
  "success": true,
  "message": "Subjects retrieved successfully",
  "data": {
    "subjects": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 25,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### 2.3. Cập nhật môn học

**PUT** `/subjects/:id`

**Headers**: `Authorization: Bearer <admin_token>`

**Request Body**:

```json
{
  "name": "Tiếng Anh (IELTS/TOEFL)",
  "description": "Cập nhật mô tả mới",
  "category": "NGOAI_NGU",
  "isActive": false
}
```

### 2.4. Xóa môn học (Soft Delete)

**DELETE** `/subjects/:id`

**Headers**: `Authorization: Bearer <admin_token>`

**Mô tả**: Không xóa vĩnh viễn, chỉ set `isActive = false`

---

# TutorPost APIs

## 1. Public APIs

### 1.1. Tìm kiếm bài đăng gia sư

**GET** `/tutor-posts/search`

**Mô tả**: Tìm kiếm gia sư với nhiều bộ lọc. Đây là API chính để học viên tìm gia sư.

**Query Parameters**:

- `subjects` (optional): Danh sách ID môn học, cách nhau bởi dấu phẩy
- `teachingMode` (optional): `ONLINE`, `OFFLINE`, `BOTH`
- `studentLevel` (optional): Danh sách cấp độ học sinh, cách nhau bởi dấu phẩy
  - `TIEU_HOC`, `TRUNG_HOC_CO_SO`, `TRUNG_HOC_PHO_THONG`, `DAI_HOC`, `NGUOI_DI_LAM`, `KHAC`
- `priceMin` (optional): Giá tối thiểu (VND)
- `priceMax` (optional): Giá tối đa (VND)
- `province` (optional): ID tỉnh/thành phố
- `district` (optional): ID quận/huyện
- `search` (optional): Tìm kiếm trong title, description, experience
- `page` (optional): Số trang (mặc định: 1)
- `limit` (optional): Số item/trang (1-50, mặc định: 20)
- `sortBy` (optional): `createdAt`, `pricePerSession`, `viewCount`
- `sortOrder` (optional): `asc`, `desc`

**Example**:

```
GET /tutor-posts/search?subjects=67890abc,67890def&teachingMode=BOTH&priceMin=200000&priceMax=500000&province=79&page=1&limit=10&sortBy=pricePerSession&sortOrder=asc
```

**Response**:

```json
{
  "success": true,
  "message": "Search completed successfully",
  "data": {
    "posts": [
      {
        "_id": "67890...",
        "tutorId": {
          "_id": "12345...",
          "name": "Nguyễn Văn A",
          "gender": "male"
        },
        "title": "Gia sư Toán - Vật Lý cấp 3",
        "description": "5 năm kinh nghiệm...",
        "experience": "Tốt nghiệp ĐH Bách Khoa...",
        "videoIntroUrl": "https://...",
        "subjects": [
          {
            "_id": "67890abc",
            "name": "Toán",
            "category": "TOAN_HOC"
          }
        ],
        "pricePerSession": 300000,
        "sessionDuration": 120,
        "teachingMode": "BOTH",
        "studentLevel": ["TRUNG_HOC_PHO_THONG"],
        "teachingSchedule": [
          {
            "dayOfWeek": 1,
            "startTime": "19:00",
            "endTime": "21:00"
          }
        ],
        "address": {
          "province": "79",
          "district": "760"
        },
        "status": "ACTIVE",
        "viewCount": 15,
        "contactCount": 3,
        "createdAt": "2025-10-01T...",
        "updatedAt": "2025-10-01T..."
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 87,
      "hasNext": true,
      "hasPrev": false
    },
    "filters": {
      "subjects": ["67890abc", "67890def"],
      "teachingMode": "BOTH",
      "priceMin": 200000,
      "priceMax": 500000
    }
  }
}
```

### 1.2. Xem chi tiết bài đăng

**GET** `/tutor-posts/:postId`

**Mô tả**: Xem chi tiết bài đăng gia sư. Tự động tăng `viewCount`.

**Response**:

- Nếu **chưa đăng nhập**: Ẩn email của tutor, chỉ hiển thị tỉnh/quận trong địa chỉ
- Nếu **đã đăng nhập**: Hiển thị đầy đủ thông tin

### 1.3. Tăng số lượt liên hệ

**POST** `/tutor-posts/:postId/contact`

**Mô tả**: Gọi API này khi học viên liên hệ với gia sư để tăng `contactCount`.

---

## 2. Tutor APIs (Yêu cầu authentication + role TUTOR)

### 2.1. Tạo bài đăng mới

**POST** `/tutor-posts`

**Headers**: `Authorization: Bearer <tutor_token>`

**Điều kiện tiên quyết**:

- User phải có role `TUTOR`
- TutorProfile phải có status `VERIFIED`
- Phải có ít nhất 1 Education với status `VERIFIED`

**Request Body**:

```json
{
  "title": "Gia sư Toán - Vật Lý cấp 3",
  "description": "Tôi là sinh viên năm cuối ĐH Bách Khoa Hà Nội, chuyên ngành Toán-Tin. Với 5 năm kinh nghiệm dạy học, tôi đã giúp nhiều em học sinh cải thiện đáng kể kết quả học tập...",
  "experience": "- 5 năm kinh nghiệm dạy kèm\n- Đã dạy hơn 50 học sinh\n- Tỷ lệ đỗ đại học 95%",
  "videoIntroUrl": "https://youtube.com/watch?v=...",
  "subjects": ["67890abc", "67890def"],
  "pricePerSession": 300000,
  "sessionDuration": 120,
  "teachingMode": "BOTH",
  "studentLevel": ["TRUNG_HOC_CO_SO", "TRUNG_HOC_PHO_THONG"],
  "teachingSchedule": [
    {
      "dayOfWeek": 1,
      "startTime": "19:00",
      "endTime": "21:00"
    },
    {
      "dayOfWeek": 3,
      "startTime": "19:00",
      "endTime": "21:00"
    }
  ],
  "address": {
    "province": "79",
    "district": "760",
    "ward": "26734",
    "specificAddress": "123 Đường ABC, Phường XYZ"
  }
}
```

**Validation Rules**:

- `title`: Bắt buộc, tối đa 150 ký tự
- `description`: Bắt buộc, tối đa 2000 ký tự
- `experience`: Bắt buộc, tối đa 1500 ký tự
- `videoIntroUrl`: Tùy chọn, phải là URL hợp lệ
- `subjects`: Mảng ID môn học, ít nhất 1 môn
- `pricePerSession`: 100,000 - 10,000,000 VND
- `sessionDuration`: 60, 90, 120, 150, hoặc 180 phút
- `teachingMode`: `ONLINE`, `OFFLINE`, `BOTH`
- `studentLevel`: Mảng cấp độ, ít nhất 1 cấp
- `teachingSchedule`: Mảng lịch dạy, ít nhất 1 slot
  - `dayOfWeek`: 0-6 (0=Chủ Nhật)
  - `startTime`, `endTime`: Format "HH:mm"
- `address`: Bắt buộc nếu `teachingMode` là `OFFLINE` hoặc `BOTH`

**Ràng buộc đặc biệt**:

- Lịch dạy không được trùng trong cùng bài đăng
- Lịch dạy không được trùng với các bài đăng khác của cùng tutor

### 2.2. Lấy danh sách bài đăng của tôi

**GET** `/tutor-posts`

**Headers**: `Authorization: Bearer <tutor_token>`

**Query Parameters**:

- `page` (optional): Số trang (mặc định: 1)
- `limit` (optional): Số item/trang (1-50, mặc định: 10)

**Response**:

```json
{
  "success": true,
  "message": "Tutor posts retrieved successfully",
  "data": {
    "posts": [...],
    "pagination": {...}
  }
}
```

### 2.3. Cập nhật bài đăng

**PUT** `/tutor-posts/:postId`

**Headers**: `Authorization: Bearer <tutor_token>`

**Mô tả**: Chỉ tutor tạo bài đăng mới có quyền cập nhật.

**Request Body**: Tương tự POST nhưng tất cả fields đều optional.

### 2.4. Kích hoạt bài đăng

**POST** `/tutor-posts/:postId/activate`

**Headers**: `Authorization: Bearer <tutor_token>`

**Mô tả**: Chuyển trạng thái bài đăng thành `ACTIVE`.

### 2.5. Tắt kích hoạt bài đăng

**POST** `/tutor-posts/:postId/deactivate`

**Headers**: `Authorization: Bearer <tutor_token>`

**Mô tả**: Chuyển trạng thái bài đăng thành `INACTIVE`.

### 2.6. Xóa bài đăng

**DELETE** `/tutor-posts/:postId`

**Headers**: `Authorization: Bearer <tutor_token>`

**Mô tả**: Xóa vĩnh viễn bài đăng. Chỉ tutor tạo bài mới có quyền xóa.

---

# Error Responses

Tất cả API đều sử dụng format error response thống nhất:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error description (optional)"
}
```

## Các HTTP Status Codes thường gặp:

- **200**: Thành công
- **201**: Tạo mới thành công
- **400**: Lỗi request (validation, missing data)
- **401**: Chưa xác thực (missing/invalid token)
- **403**: Không có quyền truy cập (wrong role)
- **404**: Không tìm thấy resource
- **500**: Lỗi server

## Validation Errors:

```json
{
  "success": false,
  "message": "Title must not exceed 150 characters",
  "data": [
    {
      "field": "title",
      "message": "Title must not exceed 150 characters"
    },
    {
      "field": "pricePerSession",
      "message": "Price per session must be between 100,000 and 10,000,000 VND"
    }
  ]
}
```

---

# Examples Usage

## 1. Workflow: Tutor tạo bài đăng

```javascript
// 1. Lấy danh sách môn học để chọn
const subjects = await fetch('/api/v1/subjects/active');

// 2. Tạo bài đăng mới
const newPost = await fetch('/api/v1/tutor-posts', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer your_token',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'Gia sư Toán cấp 3',
    description: '...',
    // ... other fields
  }),
});

// 3. Kích hoạt bài đăng
await fetch(`/api/v1/tutor-posts/${postId}/activate`, {
  method: 'POST',
  headers: { Authorization: 'Bearer your_token' },
});
```

## 2. Workflow: Học viên tìm gia sư

```javascript
// 1. Tìm kiếm gia sư
const results = await fetch(
  '/api/v1/tutor-posts/search?subjects=math_id&priceMax=500000'
);

// 2. Xem chi tiết bài đăng
const detail = await fetch(`/api/v1/tutor-posts/${postId}`);

// 3. Liên hệ gia sư (tăng contact count)
await fetch(`/api/v1/tutor-posts/${postId}/contact`, { method: 'POST' });
```

## 3. Workflow: Admin quản lý môn học

```javascript
// 1. Tạo môn học mới
await fetch('/api/v1/subjects', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer admin_token',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Tiếng Hàn',
    category: 'NGOAI_NGU',
    description: '...',
  }),
});

// 2. Cập nhật môn học
await fetch(`/api/v1/subjects/${subjectId}`, {
  method: 'PUT',
  headers: {
    Authorization: 'Bearer admin_token',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    isActive: false,
  }),
});
```

---

# Notes

1. **Phân quyền**:
   - Public APIs: Không cần token
   - Tutor APIs: Cần token + role TUTOR + profile verified
   - Admin APIs: Cần token + role ADMIN

2. **Bảo mật**:
   - Thông tin email tutor chỉ hiển thị khi đã đăng nhập
   - Địa chỉ chi tiết chỉ hiển thị cho người đã đăng nhập
   - CCCD không bao giờ được public

3. **Performance**:
   - APIs có pagination để tránh load quá nhiều data
   - Search API có nhiều index để tối ưu tốc độ

4. **Data Consistency**:
   - Lịch dạy không được trùng lặp
   - Soft delete cho subjects để tránh ảnh hưởng data existing
