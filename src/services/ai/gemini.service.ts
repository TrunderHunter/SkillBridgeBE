import { logger } from './../../utils/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';


/**
 * Gemini AI Service for text embedding and content generation
 * Used for semantic search and smart recommendations
 */
class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private embeddingModel: string = 'embedding-001';
  private textModel: string = 'gemini-pro';

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
      return 'Gia sư có kinh nghiệm phù hợp với yêu cầu của bạn.';
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
