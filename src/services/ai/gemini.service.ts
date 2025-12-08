import { logger } from './../../utils/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';


/**
 * Gemini AI Service for text embedding and content generation
 * Used for semantic search and smart recommendations
 */
class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private embeddingModel: string = 'text-embedding-004';
  private textModel: string = 'gemini-2.0-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      logger.warn('⚠️ GEMINI_API_KEY not found. AI features will be disabled.');
      // Don't throw error, just disable AI features
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      logger.info('✅ Gemini AI Service initialized');
    }
  }

  /**
   * Check if Gemini service is available
   */
  isAvailable(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  /**
   * Generate embedding vector for text
   * @param text - Text to convert to vector
   * @returns Array of numbers (embedding vector)
   */
  async getEmbedding(text: string): Promise<number[]> {
    if (!this.isAvailable() || !this.genAI) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.embeddingModel });
      const result = await model.embedContent(text);
      
      return result.embedding.values;
    } catch (error: any) {
      logger.error('❌ Gemini embedding error:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param texts - Array of texts to convert
   * @returns Array of embedding vectors
   */
  async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isAvailable() || !this.genAI) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.embeddingModel });
      const embeddings: number[][] = [];

      // Process in batches of 5 to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(text => model.embedContent(text))
        );
        
        embeddings.push(...batchResults.map(r => r.embedding.values));
        
        // Small delay between batches
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return embeddings;
    } catch (error: any) {
      logger.error('❌ Gemini batch embedding error:', error);
      throw new Error(`Failed to generate batch embeddings: ${error.message}`);
    }
  }

  /**
   * Generate explanation for why a tutor matches a student post
   * Uses Gemini to create human-readable match reasons
   * @param studentPost - Student's post data
   * @param tutorProfile - Tutor's profile data
   * @param matchScore - Similarity score (0-1)
   * @returns Explanation text
   */
  async generateMatchExplanation(
    studentPost: any,
    tutorProfile: any,
    matchScore: number
  ): Promise<string> {
    if (!this.isAvailable() || !this.genAI) {
      return 'Gia sư phù hợp với yêu cầu của bạn.';
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.textModel });

      const prompt = `
Bạn là trợ lý AI giúp giải thích lý do tại sao một gia sư phù hợp với học viên.

THÔNG TIN HỌC VIÊN:
- Môn học cần: ${studentPost.subjects?.join(', ')}
- Lớp: ${studentPost.grade_levels?.join(', ')}
- Yêu cầu: ${studentPost.requirements || 'Không có yêu cầu đặc biệt'}
- Chi tiết: ${studentPost.content}

THÔNG TIN GIA SƯ:
- Tên: ${tutorProfile.full_name}
- Môn dạy: ${tutorProfile.subjects?.join(', ')}
- Kinh nghiệm: ${tutorProfile.teaching_experience || 'Chưa cập nhật'}
- Giới thiệu: ${tutorProfile.introduction || ''}

ĐỘ PHÙHỢP: ${(matchScore * 100).toFixed(0)}%

Hãy viết 1-2 câu ngắn gọn (tối đa 150 ký tự) giải thích TẠI SAO gia sư này phù hợp.
Tập trung vào điểm MẠNH và sự KHỚP với yêu cầu.
Không cần nói "Gia sư này" hay "Học viên cần", chỉ nêu lý do trực tiếp.

VÍ DỤ TỐT:
- "Có 3 năm kinh nghiệm dạy Vật Lý lớp 12, chuyên luyện thi đại học"
- "Chuyên môn cao về Hóa học hữu cơ, phương pháp giảng dạy dễ hiểu"

Giải thích (tối đa 150 ký tự):`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const explanation = response.text().trim();

      // Limit to 150 characters
      return explanation.length > 150 
        ? explanation.substring(0, 147) + '...'
        : explanation;

    } catch (error: any) {
      logger.error('❌ Gemini explanation error:', error);
      // Re-throw error so caller can handle fallback
      throw error;
    }
  }

  /**
   * Generate explanation for why a student post matches a tutor
   * Uses Gemini to create human-readable match reasons
   * @param tutorSummary - Tutor's profile summary
   * @param studentPost - Student's post data
   * @param matchScore - Similarity score (0-1)
   * @returns Explanation text
   */
  async generateStudentMatchExplanation(
    tutorSummary: any,
    studentPost: any,
    matchScore: number,
    matchDetails?: any
  ): Promise<string> {
    logger.info('🤖 [generateStudentMatchExplanation] Called with:', {
      tutorSubjects: tutorSummary.subjects?.length,
      studentSubjects: studentPost.subjects?.length,
      matchScore,
      hasMatchDetails: !!matchDetails,
    });

    if (!this.isAvailable() || !this.genAI) {
      logger.warn('⚠️ [generateStudentMatchExplanation] Gemini not available, using fallback');
      return 'Bài đăng này phù hợp với hồ sơ và khả năng dạy của bạn.';
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.textModel });
      logger.info('✅ [generateStudentMatchExplanation] Gemini model loaded');

      const subjectNames = studentPost.subjects?.map((s: any) =>
        typeof s === 'object' ? s.name : s
      ).join(', ') || 'N/A';

      const tutorSubjects = tutorSummary.subjects?.map((s: any) => 
        typeof s === 'object' ? s.name : s
      ).join(', ') || 'N/A';

      // Build match details info
      let matchInfo = '';
      if (matchDetails) {
        const matches = [];
        if (matchDetails.subjectMatch === 100) {
          matches.push(`✓ Môn học KHỚP: ${subjectNames}`);
        }
        if (matchDetails.levelMatch === 100) {
          matches.push(`✓ Cấp độ KHỚP: ${studentPost.grade_levels?.join(', ')}`);
        }
        if (matchDetails.priceMatch === 100) {
          matches.push(`✓ Mức giá PHÙ HỢP`);
        }
        if (matchDetails.modeMatch === 100) {
          const mode = studentPost.is_online ? 'Online' : 'Offline';
          matches.push(`✓ Hình thức ${mode} PHÙ HỢP`);
        }
        matchInfo = matches.length > 0 ? `\n\nCÁC ĐIỂM KHỚP:\n${matches.join('\n')}` : '';
      }

      const prompt = `
Bạn là trợ lý AI chuyên phân tích sự phù hợp giữa gia sư và học viên.

THÔNG TIN GIA SƯ (BẠN):
- Tiêu đề: ${tutorSummary.headline || 'Chưa cập nhật'}
- Môn dạy: ${tutorSubjects}
- Kinh nghiệm: ${tutorSummary.teaching_experience || 'Chưa cập nhật'}
- Giới thiệu: ${tutorSummary.introduction || 'Chưa có thông tin'}
${tutorSummary.pricePerSession ? `- Học phí: ${tutorSummary.pricePerSession?.toLocaleString('vi-VN')} VNĐ/buổi` : ''}
${tutorSummary.teachingMode ? `- Hình thức: ${tutorSummary.teachingMode}` : ''}

THÔNG TIN BÀI ĐĂNG TÌM GIA SƯ:
- Tiêu đề: ${studentPost.title}
- Môn học cần: ${subjectNames}
- Lớp: ${studentPost.grade_levels?.join(', ') || 'N/A'}
- Học phí mong muốn: ${studentPost.hourly_rate?.min ? `${studentPost.hourly_rate.min?.toLocaleString('vi-VN')} - ${studentPost.hourly_rate.max?.toLocaleString('vi-VN')} VNĐ/giờ` : 'Thỏa thuận'}
- Hình thức: ${studentPost.is_online ? 'Online' : 'Offline'}
- Yêu cầu: ${studentPost.requirements || 'Không có yêu cầu đặc biệt'}
- Chi tiết: ${studentPost.content || 'Không có mô tả chi tiết'}
${matchInfo}

ĐỘ PHÙ HỢP: ${(matchScore * 100).toFixed(0)}%

NHIỆM VỤ:
Viết 1 đoạn văn CHI TIẾT (150-200 từ) giải thích TẠI SAO bài đăng học viên này PHÙ HỢP với BẠN (gia sư).

QUY TẮC QUAN TRỌNG:
1. BẮT ĐẦU BẰNG: "Học viên cần [môn học cụ thể] [cấp độ cụ thể]..."
2. NÊU CỤ THỂ các điểm khớp theo thứ tự:
   - Môn học: "Bạn đang dạy [môn] và [kinh nghiệm cụ thể]"
   - Cấp độ: "Bạn có kinh nghiệm với [cấp độ], [thành tích/phương pháp]"
   - Mức giá: "Học phí bạn đưa ra [so sánh với mong muốn của học viên]"
   - Hình thức: "Bạn [có thể dạy online/offline], phù hợp với nhu cầu"
3. NHẤN MẠNH điểm mạnh CỤ THỂ của bạn: số năm kinh nghiệm, phương pháp giảng dạy, thành tích học viên cũ
4. KHÔNG DÙNG từ chung chung như "phù hợp", "khớp", "tốt" mà phải nêu SỰ THẬT CỤ THỂ
5. KẾT THÚC với lý do TẠI SAO học viên nên chọn bạn

VÍ DỤ XUẤT SẮC:
"Học viên cần gia sư Toán lớp 12 luyện thi THPT Quốc gia với học phí 150,000-200,000 VNĐ/giờ. Bạn có 5 năm kinh nghiệm dạy Toán THPT, đã giúp 20+ học sinh đạt điểm 9-10 trong kỳ thi. Học phí bạn đưa ra là 180,000 VNĐ/giờ, nằm trong khoảng học viên mong muốn. Bạn dạy theo phương pháp tư duy logic, giải nhanh bài khó, và có tài liệu riêng cho từng chủ đề. Với kinh nghiệm chuyên luyện thi và tỷ lệ học sinh đỗ đại học cao, bạn sẽ giúp học viên đạt mục tiêu."

VÍ DỤ TỆ (KHÔNG LÀM):
"Bài đăng này phù hợp với hồ sơ của bạn vì môn học và cấp độ khớp."

HÃY VIẾT (150-200 từ):`;

      logger.info('📤 [generateStudentMatchExplanation] Sending prompt to Gemini...');
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let explanation = response.text().trim();

      logger.info('📥 [generateStudentMatchExplanation] Received response from Gemini:', {
        length: explanation.length,
        preview: explanation.substring(0, 100),
      });

      // Remove markdown formatting if present
      explanation = explanation.replace(/\*\*/g, '').replace(/\*/g, '');

      // Limit to reasonable length (around 600 characters for Vietnamese)
      if (explanation.length > 600) {
        explanation = explanation.substring(0, 597) + '...';
        logger.info('✂️ [generateStudentMatchExplanation] Trimmed explanation to 600 chars');
      }

      logger.info('✅ [generateStudentMatchExplanation] Final explanation ready');
      return explanation;

    } catch (error: any) {
      logger.error('❌ [generateStudentMatchExplanation] Gemini error:', error);
      // Re-throw error so caller can handle fallback with detailed rule-based explanation
      throw error;
    }
  }

  /**
   * Generate JSON response using Gemini (helper for structured outputs)
   */
  async generateJsonResponse(prompt: string): Promise<any> {
    if (!this.isAvailable() || !this.genAI) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.textModel });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        } as any,
      });
      const response = await result.response;
      const text = response.text()?.trim();
      if (!text) {
        throw new Error('Empty AI response');
      }
      return JSON.parse(text);
    } catch (error: any) {
      logger.error('❌ Gemini JSON generation error:', error);
      throw new Error(error.message || 'Không thể sinh nội dung AI');
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param vecA - First vector
   * @param vecB - Second vector
   * @returns Similarity score (0-1)
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

export const geminiService = new GeminiService();
