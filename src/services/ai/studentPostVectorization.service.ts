import { Post } from '../../models/Post';
import { Subject } from '../../models/Subject';
import { geminiService } from './gemini.service';
import { logger } from './../../utils/logger';

/**
 * Student Post Vectorization Service
 * Automatically generates and updates embedding vectors for student posts
 */
class StudentPostVectorizationService {
  /**
   * Generate and save vector for a single student post
   * @param postId - ID of student post
   */
  async vectorizeStudentPost(postId: string): Promise<boolean> {
    try {
      if (!geminiService.isAvailable()) {
        logger.warn('Gemini API not available, skipping vectorization');
        return false;
      }

      // Get student post with populated subjects
      const post = await Post.findById(postId)
        .populate('subjects', 'name')
        .lean();

      if (!post) {
        throw new Error('Student post not found');
      }

      // Only vectorize approved posts
      if (post.status !== 'approved') {
        logger.info(`⏭️ Skipping vectorization for post ${postId} (status: ${post.status})`);
        return false;
      }

      // Build comprehensive text for embedding
      const postText = this.buildPostText(post);

      logger.info(`📝 Generating vector for student post: ${postId}`);
      logger.info(`Post text length: ${postText.length} characters`);

      // Generate embedding vector
      const vector = await geminiService.getEmbedding(postText);

      // Save vector to post
      await Post.findByIdAndUpdate(postId, {
        postVector: vector,
        vectorUpdatedAt: new Date(),
      });

      logger.info(`✅ Vector saved for student post: ${postId}`);
      return true;

    } catch (error: any) {
      logger.error(`❌ Failed to vectorize student post ${postId}:`, error);
      return false;
    }
  }

  /**
   * Batch vectorize multiple student posts
   * @param postIds - Array of post IDs
   */
  async batchVectorizeStudentPosts(postIds: string[]): Promise<{
    success: number;
    failed: number;
  }> {
    let success = 0;
    let failed = 0;

    logger.info(`🔄 Starting batch vectorization for ${postIds.length} posts`);

    for (const postId of postIds) {
      const result = await this.vectorizeStudentPost(postId);
      if (result) {
        success++;
      } else {
        failed++;
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info(`✅ Batch vectorization complete: ${success} success, ${failed} failed`);

    return { success, failed };
  }

  /**
   * Vectorize all approved student posts
   * Useful for initial setup or bulk updates
   */
  async vectorizeAllApprovedPosts(): Promise<{
    success: number;
    failed: number;
  }> {
    try {
      // Get all approved posts that don't have vectors or need update
      const posts = await Post.find({
        status: 'approved',
        type: 'student_request',
        $or: [
          { postVector: null },
          { postVector: { $exists: false } },
          {
            $expr: {
              $lt: [
                { $ifNull: ['$vectorUpdatedAt', new Date(0)] },
                { $subtract: ['$updated_at', 1000 * 60 * 60 * 24] } // 24 hours old
              ]
            }
          }
        ]
      }).select('_id');

      if (posts.length === 0) {
        logger.info('✅ All approved posts already have up-to-date vectors');
        return { success: 0, failed: 0 };
      }

      const postIds = posts.map(p => p._id);
      logger.info(`🔄 Found ${postIds.length} posts to vectorize`);

      return await this.batchVectorizeStudentPosts(postIds);

    } catch (error: any) {
      logger.error('❌ Failed to vectorize all posts:', error);
      return { success: 0, failed: 0 };
    }
  }

  /**
   * Build comprehensive post text for embedding
   */
  private buildPostText(post: any): string {
    const parts: string[] = [];

    // Title
    if (post.title) {
      parts.push(`Tiêu đề: ${post.title}`);
    }

    // Content
    if (post.content) {
      parts.push(`Nội dung: ${post.content}`);
    }

    // Subjects
    if (post.subjects && post.subjects.length > 0) {
      const subjectNames = post.subjects.map((s: any) =>
        typeof s === 'object' ? s.name : s
      ).join(', ');
      parts.push(`Môn học: ${subjectNames}`);
    }

    // Grade levels
    if (post.grade_levels && post.grade_levels.length > 0) {
      parts.push(`Lớp: ${post.grade_levels.join(', ')}`);
    }

    // Requirements
    if (post.requirements) {
      parts.push(`Yêu cầu: ${post.requirements}`);
    }

    // Availability
    if (post.availability) {
      parts.push(`Thời gian rảnh: ${post.availability}`);
    }

    // Teaching mode
    if (post.is_online !== undefined) {
      parts.push(`Hình thức: ${post.is_online ? 'Online' : 'Offline'}`);
    }

    // Location (if offline)
    if (post.location && !post.is_online) {
      parts.push(`Địa điểm: ${post.location}`);
    }

    // Price range
    if (post.hourly_rate) {
      const { min, max } = post.hourly_rate;
      if (min !== undefined && max !== undefined) {
        parts.push(`Học phí: ${min.toLocaleString('vi-VN')} - ${max.toLocaleString('vi-VN')} VNĐ/giờ`);
      } else if (min !== undefined) {
        parts.push(`Học phí tối thiểu: ${min.toLocaleString('vi-VN')} VNĐ/giờ`);
      } else if (max !== undefined) {
        parts.push(`Học phí tối đa: ${max.toLocaleString('vi-VN')} VNĐ/giờ`);
      }
    }

    const fullText = parts.join('. ');

    // Limit text length to avoid token limits (max ~8000 tokens ≈ 32000 chars)
    return fullText.length > 30000
      ? fullText.substring(0, 30000) + '...'
      : fullText;
  }

  /**
   * Check if a post needs vectorization
   */
  async needsVectorization(postId: string): Promise<boolean> {
    const post = await Post.findById(postId)
      .select('postVector vectorUpdatedAt updated_at status');

    if (!post) return false;

    // Don't vectorize non-approved posts
    if (post.status !== 'approved') return false;

    // No vector exists
    if (!post.postVector || post.postVector.length === 0) {
      return true;
    }

    // Vector is outdated (post updated after vector)
    if (post.vectorUpdatedAt && post.updated_at) {
      const vectorAge = post.updated_at.getTime() - post.vectorUpdatedAt.getTime();
      return vectorAge > 1000 * 60 * 60 * 24; // 24 hours
    }

    return false;
  }
}

export const studentPostVectorizationService = new StudentPostVectorizationService();

