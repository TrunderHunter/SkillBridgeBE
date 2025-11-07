# 🤖 Smart Tutor Recommendation System - AI Implementation Guide

## 📋 Overview

Hệ thống gợi ý gia sư thông minh sử dụng **Hybrid Search** kết hợp:

- **Structured Filtering**: Lọc cứng theo môn học, lớp, giá, lịch học
- **Semantic Search**: Tìm kiếm ngữ nghĩa bằng AI Vector (Gemini Embedding)
- **AI Explanations**: Giải thích lý do match bằng Gemini AI

## 🏗️ Architecture

```
Student Post → Smart Recommendation Service
                  ↓
        ┌─────────┴─────────┐
        ↓                    ↓
  Structured Filter    Semantic Vector Search
  (MongoDB Query)      (Cosine Similarity)
        ↓                    ↓
        └─────────┬─────────┘
                  ↓
        Hybrid Scoring (70/30)
                  ↓
        Top N Results + AI Explanations
```

## 🔧 Setup

### 1. Install Dependencies

```bash
cd SkillBridgeBE
npm install @google/generative-ai
```

### 2. Get Gemini API Key

1. Truy cập: https://makersuite.google.com/app/apikey
2. Tạo API key mới
3. Copy API key

### 3. Configure Environment

Thêm vào `.env`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Build & Restart

```bash
npm run build
npm start
```

## 📡 API Endpoints

### 1. Check AI Status

```http
GET /api/v1/ai/status
```

**Response:**

```json
{
  "success": true,
  "message": "AI service status",
  "data": {
    "geminiAvailable": true,
    "features": {
      "smartRecommendations": true,
      "semanticSearch": true,
      "matchExplanations": true
    }
  }
}
```

### 2. Get Smart Recommendations (Student)

```http
GET /api/v1/ai/posts/:postId/smart-recommendations?limit=10&minScore=0.5&includeExplanations=true
Authorization: Bearer <student_token>
```

**Query Parameters:**

- `limit` (optional): Số lượng gợi ý tối đa (1-50, default: 10)
- `minScore` (optional): Điểm tối thiểu (0-1, default: 0.5)
- `includeExplanations` (optional): Có tạo giải thích AI không (default: true)

**Response:**

```json
{
  "success": true,
  "message": "Tìm thấy các gợi ý phù hợp",
  "data": {
    "total": 5,
    "recommendations": [
      {
        "tutorId": "uuid-123",
        "matchScore": 92,
        "explanation": "Có 3 năm kinh nghiệm dạy Vật Lý lớp 12, chuyên luyện thi đại học",
        "tutor": {
          "name": "Nguyễn Văn A",
          "email": "tutor@example.com",
          "phone": "0901234567",
          "avatar": "https://...",
          "headline": "Gia sư Vật Lý 5 năm kinh nghiệm",
          "introduction": "..."
        },
        "tutorPost": {
          "id": "post-uuid",
          "title": "Dạy Vật Lý lớp 12",
          "description": "...",
          "subjects": [...],
          "pricePerSession": 150000,
          "sessionDuration": 90,
          "teachingMode": "BOTH",
          "studentLevel": ["Lớp 12"]
        },
        "matchDetails": {
          "subjectMatch": true,
          "levelMatch": true,
          "priceMatch": true,
          "scheduleMatch": true,
          "semanticScore": 0.87
        }
      }
    ]
  }
}
```

### 3. Vectorize Tutor Profile (Tutor)

```http
POST /api/v1/ai/tutors/profile/vectorize
Authorization: Bearer <tutor_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Cập nhật vector thành công",
  "data": {
    "profileId": "profile-uuid",
    "vectorUpdatedAt": "2025-11-02T10:30:00Z"
  }
}
```

### 4. Batch Vectorize All Profiles (Admin)

```http
POST /api/v1/ai/admin/tutors/vectorize-all
Authorization: Bearer <admin_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Hoàn thành vectorization",
  "data": {
    "success": 48,
    "failed": 2,
    "total": 50
  }
}
```

## 🔄 Workflow

### Phase 1: One-time Vectorization (Initial Setup)

```bash
# 1. Admin vectorizes all verified tutor profiles
POST /api/v1/ai/admin/tutors/vectorize-all
```

Điều này sẽ:

- Lấy tất cả TutorProfile với status=VERIFIED
- Gộp headline + introduction + teaching_experience + tutorPosts
- Gọi Gemini API để tạo vector (embedding)
- Lưu vector vào field `profileVector`

### Phase 2: Auto Vectorization (Ongoing)

**Hook vào các events:**

1. **Khi Tutor Profile được VERIFIED:**

   ```typescript
   // In tutorProfile.controller.ts after verification
   await profileVectorizationService.vectorizeTutorProfile(profileId);
   ```

2. **Khi Tutor cập nhật profile:**

   ```typescript
   // In tutorProfile.controller.ts after update
   if (profile.status === 'VERIFIED') {
     await profileVectorizationService.vectorizeTutorProfile(profileId);
   }
   ```

3. **Tutor có thể tự trigger:**
   ```typescript
   // Tutor clicks "Cập nhật gợi ý AI" button
   POST / api / v1 / ai / tutors / profile / vectorize;
   ```

### Phase 3: Smart Recommendations (Real-time)

```bash
# Student creates post
POST /api/v1/posts

# Student gets smart recommendations
GET /api/v1/ai/posts/{postId}/smart-recommendations
```

Flow:

1. Parse student post → extract subjects, levels, price, requirements
2. **Hard Filter**: Query MongoDB với điều kiện cứng
3. **Generate Query Vector**: Gemini embedding từ requirements text
4. **Calculate Similarity**: Cosine similarity với từng tutor vector
5. **Hybrid Score**: 70% structured + 30% semantic
6. **Generate Explanations**: Gemini AI tạo lý do match
7. Return top N results

## 🎯 Scoring Algorithm

### Structured Match Score (70%)

```typescript
structuredScore =
  subjectMatch * 0.3 + // 30% weight
  levelMatch * 0.25 + // 25% weight
  priceMatch * 0.25 + // 25% weight
  modeMatch * 0.2; // 20% weight
```

### Semantic Match Score (30%)

```typescript
semanticScore = cosineSimilarity(queryVector, tutorVector);
```

### Final Match Score

```typescript
finalScore = structuredScore * 0.7 + semanticScore * 0.3;
```

## 📊 Example Use Case

**Student Post:**

```json
{
  "title": "Tìm sư sư dạy Lý Hóa 12",
  "content": "Em đang học lớp 12, cần ôn thi đại học môn Vật Lý và Hóa",
  "subjects": ["Vật lý", "Hóa học"],
  "grade_levels": ["Lớp 12"],
  "hourly_rate": { "min": 20000, "max": 200000 },
  "requirements": "có 3 năm kn",
  "is_online": true
}
```

**Tutor Profile A:**

```json
{
  "headline": "Gia sư Vật Lý 5 năm kinh nghiệm",
  "introduction": "Tôi có kinh nghiệm 3 năm dạy Vật Lý lớp 12, chuyên luyện thi đại học",
  "teaching_experience": "Dạy tại trung tâm ABC từ 2020-2023",
  "subjects": ["Vật lý"],
  "levels": ["Lớp 12"],
  "pricePerSession": 150000
}
```

**Match Result:**

```json
{
  "matchScore": 92,
  "explanation": "Có 3 năm kinh nghiệm dạy Vật Lý lớp 12, chuyên luyện thi đại học",
  "matchDetails": {
    "subjectMatch": true, // Vật lý ✓
    "levelMatch": true, // Lớp 12 ✓
    "priceMatch": true, // 150k trong range ✓
    "scheduleMatch": true,
    "semanticScore": 0.87 // High similarity: "3 năm kn" ≈ "kinh nghiệm 3 năm"
  }
}
```

## 🔍 Vector Search Details

### What is Embedding?

Gemini API converts text to **768-dimensional vector**:

```
Text: "Tôi có 3 năm kinh nghiệm dạy Vật Lý"
Vector: [0.123, -0.456, 0.789, ..., 0.321] (768 numbers)
```

Similar texts have similar vectors:

- "3 năm kinh nghiệm" → Vector A
- "kinh nghiệm 3 năm" → Vector B (very close to A)
- "dạy từ 2020" → Vector C (also close to A)

### Cosine Similarity

Measures angle between 2 vectors (0 to 1):

- 1.0 = Identical meaning
- 0.8-0.9 = Very similar
- 0.5-0.7 = Somewhat related
- < 0.5 = Different

## 🚀 Performance Optimization

1. **Pre-filter before vector search**: Only compare with relevant tutors
2. **Batch vectorization**: Process multiple profiles at once
3. **Cache vectors**: Don't regenerate unless profile changes
4. **Async generation**: Don't block API response for explanations

## 📝 Best Practices

1. **Vectorize sau khi VERIFIED**: Chỉ vector profiles đã xác thực
2. **Re-vectorize khi update**: Cập nhật vector khi profile thay đổi
3. **Fallback mode**: Nếu Gemini API down, chỉ dùng structured filter
4. **Monitor API usage**: Gemini có giới hạn requests/minute
5. **Log performance**: Track vector generation time

## 🔐 Security

- Gemini API key stored in environment variable
- Only authenticated students can get recommendations
- Only verified tutors appear in recommendations
- Rate limiting on AI endpoints

## 📈 Monitoring

Log các metrics quan trọng:

- Vector generation success rate
- Average match scores
- API response times
- Gemini API errors

## 🐛 Troubleshooting

**Problem**: "Gemini API key not configured"

- **Solution**: Kiểm tra GEMINI_API_KEY trong .env

**Problem**: No recommendations returned

- **Solution**: Kiểm tra filters quá strict, lower minScore

**Problem**: Slow response

- **Solution**: Reduce limit, disable explanations

**Problem**: Low match scores

- **Solution**: Cần vectorize thêm tutor profiles

## 📚 References

- [Gemini API Documentation](https://ai.google.dev/docs)
- [Vector Search Guide](https://www.mongodb.com/docs/atlas/atlas-vector-search/)
- [Cosine Similarity Explained](https://en.wikipedia.org/wiki/Cosine_similarity)

---

**Created**: November 2, 2025  
**Author**: AI Smart Recommendation Team  
**Version**: 1.0.0
