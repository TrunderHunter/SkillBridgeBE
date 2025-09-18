# API Architecture Documentation - Tutor Module

## Service Pattern Implementation

Dự án đã được refactored để áp dụng service pattern theo chuẩn của `auth.controller.ts`, tách biệt logic business ra khỏi controller để tăng tính bảo trì và kiểm thử.

## Architecture Overview

```
src/
├── controllers/
│   └── tutor/
│       ├── tutorProfile.controller.ts  # Handle HTTP requests/responses only
│       ├── cccd.controller.ts          # Handle HTTP requests/responses only
│       └── index.ts                    # Export controllers
├── services/
│   └── tutor/
│       ├── tutor.service.ts            # Business logic for profile management
│       ├── cccd.service.ts             # Business logic for CCCD management
│       └── index.ts                    # Export services
├── types/
│   ├── tutor.types.ts                  # Tutor-specific interfaces
│   ├── user.types.ts                   # User-specific interfaces
│   └── index.ts                        # Export all types
└── models/
    ├── User.ts                         # User database model
    └── TutorProfile.ts                 # TutorProfile database model
```

## Services

### 1. TutorService (`tutor.service.ts`)

**Chức năng:** Xử lý logic business cho hồ sơ gia sư

**Methods:**

- `getProfile(userId: string)`: Lấy thông tin hồ sơ (User + TutorProfile)
- `updatePersonalInfo(userId, personalInfo, avatarFile?)`: Cập nhật thông tin cá nhân
- `updateIntroduction(userId, tutorProfileData)`: Cập nhật thông tin giới thiệu

**Pattern:**

```typescript
async getProfile(userId: string): Promise<TutorProfileResponse> {
  try {
    // Business logic here
    return {
      success: true,
      message: 'Lấy thông tin hồ sơ thành công',
      data: { user, profile }
    };
  } catch (error) {
    logger.error('Error message:', error);
    return {
      success: false,
      message: 'Error message in Vietnamese'
    };
  }
}
```

### 2. CCCDService (`cccd.service.ts`)

**Chức năng:** Xử lý logic business cho quản lý CCCD

**Methods:**

- `uploadImages(userId, files)`: Tải lên ảnh CCCD (max 10)
- `deleteImage(userId, imageUrl)`: Xóa ảnh CCCD
- `getImages(userId)`: Lấy danh sách ảnh CCCD
- `validateImageCount(userId, newImagesCount)`: Validate số lượng ảnh

**Features:**

- Validation số lượng ảnh tối đa (10 ảnh)
- Auto-create TutorProfile nếu chưa tồn tại
- Upload to Cloudinary với naming convention

## Controllers

### 1. TutorProfileController

**Chức năng:** Xử lý HTTP requests/responses, delegate logic cho services

**Methods:**

- `getProfile()`: GET /api/v1/tutor/profile
- `updatePersonalInfo()`: PUT /api/v1/tutor/profile/personal
- `updateIntroduction()`: PUT /api/v1/tutor/profile/introduction
- `uploadCCCDImages()`: POST /api/v1/tutor/profile/cccd
- `deleteCCCDImage()`: DELETE /api/v1/tutor/profile/cccd

**Pattern:**

```typescript
static async getProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'Người dùng chưa được xác thực', undefined, 401);
    }

    const result = await tutorService.getProfile(userId);

    if (result.success) {
      sendSuccess(res, result.message, result.data);
    } else {
      sendError(res, result.message, undefined, 404);
    }
  } catch (error) {
    logger.error('Controller error:', error);
    sendError(res, 'Vietnamese error message', undefined, 500);
  }
}
```

### 2. CCCDController

**Chức năng:** Xử lý HTTP requests/responses cho CCCD management

**Methods:**

- `uploadImages()`: POST /api/v1/tutor/cccd/upload
- `deleteImage()`: DELETE /api/v1/tutor/cccd/delete
- `getImages()`: GET /api/v1/tutor/cccd

## Types & Interfaces

### Service Interfaces

```typescript
interface ITutorProfileService {
  getProfile(userId: string): Promise<TutorProfileResponse>;
  updatePersonalInfo(
    userId: string,
    personalInfo: PersonalInfoInput,
    avatarFile?: Express.Multer.File
  ): Promise<UpdatePersonalInfoResponse>;
  updateIntroduction(
    userId: string,
    tutorProfileData: ITutorProfileInput
  ): Promise<UpdateIntroductionResponse>;
}

interface ICCCDService {
  uploadImages(
    userId: string,
    files: Express.Multer.File[]
  ): Promise<CCCDUploadResponse>;
  deleteImage(userId: string, imageUrl: string): Promise<CCCDDeleteResponse>;
  getImages(userId: string): Promise<CCCDGetResponse>;
}
```

### Response Interfaces

```typescript
interface TutorProfileResponse {
  success: boolean;
  message: string;
  data?: { user: any; profile: any };
}

interface CCCDUploadResponse {
  success: boolean;
  message: string;
  data?: { cccd_images: string[]; uploaded_count: number };
}
```

## Benefits của Service Pattern

### 1. **Separation of Concerns**

- Controllers chỉ xử lý HTTP requests/responses
- Services chứa toàn bộ business logic
- Models chỉ định nghĩa database schema

### 2. **Improved Testability**

- Business logic có thể test độc lập
- Mock services dễ dàng trong unit tests
- Integration tests rõ ràng hơn

### 3. **Better Error Handling**

- Consistent error response format
- Vietnamese error messages
- Proper HTTP status codes
- Comprehensive logging

### 4. **Code Reusability**

- Services có thể được sử dụng từ nhiều controllers
- Logic không bị trùng lặp
- Dễ dàng mở rộng tính năng

### 5. **Maintainability**

- Code structure rõ ràng
- Easy to locate and modify business logic
- TypeScript types đảm bảo type safety

## API Response Format

### Success Response

```json
{
  "success": true,
  "message": "Thông báo thành công bằng tiếng Việt",
  "data": {
    // Response data here
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Thông báo lỗi bằng tiếng Việt",
  "error": "Technical error details (optional)"
}
```

## Usage Examples

### Import Services

```typescript
import { tutorService, cccdService } from '../../services/tutor';
```

### Import Types

```typescript
import {
  TutorProfileResponse,
  PersonalInfoInput,
  AuthenticatedRequest,
} from '../../types';
```

### Service Usage

```typescript
const result = await tutorService.getProfile(userId);
if (result.success) {
  // Handle success
} else {
  // Handle error
}
```

Cấu trúc này đảm bảo code dễ bảo trì, test được, và tuân thủ nguyên tắc SOLID trong software architecture.
