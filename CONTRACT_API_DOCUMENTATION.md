# Contract Management API Documentation

## Overview
This API provides endpoints for managing electronic contracts between tutors and students in the SkillBridge platform. The contract management system is integrated into the learning flow between contact requests and class creation.

## Flow
1. **ContactRequest** is ACCEPTED by tutor
2. **Tutor creates Contract** with terms and conditions
3. **Both parties sign Contract** (student first, then tutor, or vice versa)
4. When **Contract is fully signed** → Status becomes ACTIVE
5. **LearningClass is automatically created** from the contract
6. Class sessions begin as per contract terms

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Create Contract
**POST** `/api/v1/contracts`

**Description:** Create a new contract from an accepted contact request (Tutor only)

**Request Body:**
```json
{
  "contactRequestId": "uuid-of-accepted-contact-request",
  "title": "Hợp đồng dạy Toán lớp 12",
  "description": "Dạy Toán 12 chuẩn bị thi THPT",
  "pricePerSession": 200000,
  "sessionDuration": 120,
  "totalSessions": 20,
  "learningMode": "ONLINE",
  "schedule": {
    "dayOfWeek": [1, 3, 5],
    "startTime": "19:00",
    "endTime": "21:00",
    "timezone": "Asia/Ho_Chi_Minh"
  },
  "startDate": "2025-12-01",
  "endDate": "2026-02-28",
  "onlineInfo": {
    "platform": "ZOOM",
    "meetingLink": "https://zoom.us/j/123456789"
  },
  "paymentTerms": {
    "paymentMethod": "INSTALLMENT",
    "installments": 4,
    "downPayment": 500000
  },
  "terms": {
    "cancellationPolicy": "Thông báo trước 24h để hủy buổi học",
    "refundPolicy": "Hoàn tiền 100% nếu hủy trước 7 ngày",
    "makeupPolicy": "Được bù 1 buổi nếu nghỉ có lý do chính đáng",
    "responsibilitiesOfTutor": "Chuẩn bị bài giảng, tài liệu học tập",
    "responsibilitiesOfStudent": "Hoàn thành bài tập, tham gia đầy đủ"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tạo hợp đồng thành công",
  "data": {
    "id": "contract-uuid",
    "contactRequestId": "uuid",
    "studentId": "student-uuid",
    "tutorId": "tutor-uuid",
    "status": "PENDING_STUDENT",
    "isFullySigned": false,
    "createdAt": "2025-11-14T01:00:00.000Z"
  }
}
```

### 2. Get Contract by ID
**GET** `/api/v1/contracts/:contractId`

**Description:** Get detailed information about a specific contract

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "contract-uuid",
    "title": "Hợp đồng dạy Toán lớp 12",
    "status": "ACTIVE",
    "isFullySigned": true,
    "totalAmount": 4000000,
    "paymentSchedules": [
      {
        "id": "schedule-uuid",
        "installmentNumber": 0,
        "amount": 500000,
        "dueDate": "2025-12-01",
        "status": "PENDING"
      }
    ]
  }
}
```

### 3. Get Student's Contracts
**GET** `/api/v1/contracts/student`

**Query Parameters:**
- `status` (optional): Filter by status (DRAFT, PENDING_STUDENT, PENDING_TUTOR, ACTIVE, COMPLETED, CANCELLED, EXPIRED)
- `startDate` (optional): Filter by start date (ISO 8601)
- `endDate` (optional): Filter by end date (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": [...],
  "total": 5
}
```

### 4. Get Tutor's Contracts
**GET** `/api/v1/contracts/tutor`

**Query Parameters:** Same as student's contracts

**Response:** Same structure as student's contracts

### 5. Update Contract
**PUT** `/api/v1/contracts/:contractId`

**Description:** Update contract details (Tutor only, DRAFT status only)

**Request Body:** (all fields optional)
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "schedule": {
    "dayOfWeek": [2, 4, 6],
    "startTime": "18:00",
    "endTime": "20:00"
  },
  "terms": {
    "cancellationPolicy": "Updated policy"
  }
}
```

### 6. Sign Contract
**POST** `/api/v1/contracts/:contractId/sign`

**Description:** Sign the contract (both tutor and student)

**Request Body:**
```json
{
  "signatureData": "base64-encoded-signature-or-hash"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Hợp đồng đã được ký kết hoàn tất và lớp học đã được tạo",
  "data": {
    "id": "contract-uuid",
    "status": "ACTIVE",
    "isFullySigned": true,
    "activatedAt": "2025-11-14T02:00:00.000Z"
  }
}
```

### 7. Cancel Contract
**POST** `/api/v1/contracts/:contractId/cancel`

**Description:** Cancel a contract (only before fully signed)

**Request Body:**
```json
{
  "reason": "Không thể sắp xếp được thời gian"
}
```

### 8. Get Payment Schedules
**GET** `/api/v1/contracts/:contractId/payment-schedules`

**Query Parameters:**
- `status` (optional): Filter by status (PENDING, PAID, OVERDUE, CANCELLED)
- `fromDate` (optional): Filter from date
- `toDate` (optional): Filter to date

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "schedule-uuid",
      "installmentNumber": 1,
      "amount": 875000,
      "dueDate": "2025-12-01",
      "status": "PENDING"
    }
  ],
  "total": 4
}
```

### 9. Mark Payment as Paid
**POST** `/api/v1/contracts/payment-schedules/:scheduleId/pay`

**Description:** Mark a payment schedule as paid (Student only)

**Request Body:**
```json
{
  "paymentMethod": "BANK_TRANSFER",
  "transactionId": "TXN123456",
  "paidAmount": 875000,
  "notes": "Đã chuyển khoản qua Vietcombank"
}
```

## Contract Status Flow

```
DRAFT (Initial creation)
  ↓ (Send to student)
PENDING_STUDENT (Waiting for student signature)
  ↓ (Student signs)
PENDING_TUTOR (Waiting for tutor signature)
  ↓ (Tutor signs)
ACTIVE (Both parties signed, class created automatically)
  ↓ (After all sessions completed)
COMPLETED

OR

CANCELLED (Before fully signed)
EXPIRED (Not signed within 7 days)
```

## Payment Methods

### FULL Payment
- Single payment for the entire contract
- Payment schedule contains 1 item

### INSTALLMENT Payment
- Split into multiple payments
- Can include down payment
- Payment schedules are created automatically
- Default: Monthly installments

## Contract Terms

The contract includes customizable terms:
- **Cancellation Policy**: Rules for canceling sessions
- **Refund Policy**: Conditions for refunds
- **Makeup Policy**: Rules for making up missed sessions
- **Responsibilities of Tutor**: What the tutor commits to
- **Responsibilities of Student**: What the student commits to
- **Additional Terms**: Any other agreed-upon terms

## Error Responses

All endpoints may return error responses in this format:
```json
{
  "success": false,
  "message": "Error message in Vietnamese",
  "errors": [...]  // Optional validation errors
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad request / Validation error
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not found
- `500`: Internal server error

## Notes

1. Contracts can only be created from ACCEPTED contact requests
2. Only tutors can create contracts
3. Contracts must be signed by both parties to become active
4. Once a contract is fully signed, a LearningClass is automatically created
5. Contracts in DRAFT status can be edited by the tutor
6. Contracts that are not signed within 7 days will automatically expire
7. Payment schedules are automatically created based on payment terms
8. ContractDispute functionality is not implemented as per requirements
