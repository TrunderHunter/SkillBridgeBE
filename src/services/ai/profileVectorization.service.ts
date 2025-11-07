import { TutorProfile } from '../../models/TutorProfile';
import { User } from '../../models/User';
import { TutorPost } from '../../models/TutorPost';
import { geminiService } from './gemini.service';
import { logger } from './../../utils/logger';

/**
 * Profile Vectorization Service
 * Automatically generates and updates embedding vectors for tutor profiles
 */
class ProfileVectorizationService {
  /**
   * Generate and save vector for a single tutor profile
   * @param tutorProfileId - ID of tutor profile
   */
  async vectorizeTutorProfile(tutorProfileId: string): Promise<boolean> {
    try {
      if (!geminiService.isAvailable()) {
        logger.warn('Gemini API not available, skipping vectorization');
        return false;
      }

      // Get tutor profile with user data
      const tutorProfile = await TutorProfile.findById(tutorProfileId);
      if (!tutorProfile) {
        throw new Error('Tutor profile not found');
      }

      const user = await User.findById(tutorProfile.user_id);
      if (!user) {
        throw new Error('User not found');
      }

      // Get tutor's posts to include in vectorization
      const tutorPosts = await TutorPost.find({
        tutorId: tutorProfile.user_id,
        status: 'ACTIVE'
      })
        .populate('subjects', 'name')
        .limit(5) // Latest 5 posts
        .lean();

      // Build comprehensive text for embedding
      const profileText = this.buildProfileText(user, tutorProfile, tutorPosts);

      logger.info(`📝 Generating vector for tutor profile: ${tutorProfileId}`);
      logger.info(`Profile text length: ${profileText.length} characters`);

      // Generate embedding vector
      const vector = await geminiService.getEmbedding(profileText);

      // Save vector to profile (use type assertion)
      (tutorProfile as any).profileVector = vector;
      (tutorProfile as any).vectorUpdatedAt = new Date();
      await tutorProfile.save();

      logger.info(`✅ Vector saved for tutor profile: ${tutorProfileId}`);
      return true;

    } catch (error: any) {
      logger.error(`❌ Failed to vectorize tutor profile ${tutorProfileId}:`, error);
      return false;
    }
  }

  /**
   * Batch vectorize multiple tutor profiles
   * @param tutorProfileIds - Array of tutor profile IDs
   */
  async batchVectorizeTutorProfiles(tutorProfileIds: string[]): Promise<{
    success: number;
    failed: number;
  }> {
    let success = 0;
    let failed = 0;

    logger.info(`🔄 Starting batch vectorization for ${tutorProfileIds.length} profiles`);

    for (const profileId of tutorProfileIds) {
      const result = await this.vectorizeTutorProfile(profileId);
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
   * Vectorize all verified tutor profiles
   * Useful for initial setup or bulk updates
   */
  async vectorizeAllVerifiedProfiles(): Promise<{
    success: number;
    failed: number;
  }> {
    try {
      // Get all verified tutor profiles that don't have vectors or need update
      const profiles = await TutorProfile.find({
        status: 'VERIFIED',
        $or: [
          { profileVector: null },
          { profileVector: { $exists: false } },
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

      if (profiles.length === 0) {
        logger.info('✅ All verified profiles already have up-to-date vectors');
        return { success: 0, failed: 0 };
      }

      const profileIds = profiles.map(p => p._id);
      logger.info(`🔄 Found ${profileIds.length} profiles to vectorize`);

      return await this.batchVectorizeTutorProfiles(profileIds);

    } catch (error: any) {
      logger.error('❌ Failed to vectorize all profiles:', error);
      return { success: 0, failed: 0 };
    }
  }

  /**
   * Build comprehensive profile text for embedding
   */
  private buildProfileText(
    user: any,
    tutorProfile: any,
    tutorPosts: any[]
  ): string {
    const parts: string[] = [];

    // Basic info
    if (tutorProfile.headline) {
      parts.push(`Tiêu đề: ${tutorProfile.headline}`);
    }

    // Introduction
    if (tutorProfile.introduction) {
      parts.push(`Giới thiệu: ${tutorProfile.introduction}`);
    }

    // Teaching experience
    if (tutorProfile.teaching_experience) {
      parts.push(`Kinh nghiệm: ${tutorProfile.teaching_experience}`);
    }

    // Student levels
    if (tutorProfile.student_levels) {
      parts.push(`Trình độ học viên: ${tutorProfile.student_levels}`);
    }

    // Aggregate from tutor posts
    if (tutorPosts.length > 0) {
      const subjects = new Set<string>();
      const levels = new Set<string>();

      tutorPosts.forEach(post => {
        // Collect subjects
        if (post.subjects) {
          post.subjects.forEach((subject: any) => {
            const name = typeof subject === 'object' ? subject.name : subject;
            if (name) subjects.add(name);
          });
        }

        // Collect levels
        if (post.studentLevel) {
          post.studentLevel.forEach((level: string) => levels.add(level));
        }

        // Include post descriptions
        if (post.description) {
          parts.push(post.description);
        }
      });

      if (subjects.size > 0) {
        parts.push(`Môn dạy: ${Array.from(subjects).join(', ')}`);
      }

      if (levels.size > 0) {
        parts.push(`Cấp độ: ${Array.from(levels).join(', ')}`);
      }
    }

    const fullText = parts.join('. ');

    // Limit text length to avoid token limits (max ~8000 tokens ≈ 32000 chars)
    return fullText.length > 30000 
      ? fullText.substring(0, 30000) + '...'
      : fullText;
  }

  /**
   * Check if a profile needs vectorization
   */
  async needsVectorization(tutorProfileId: string): Promise<boolean> {
    const profile = await TutorProfile.findById(tutorProfileId)
      .select('profileVector vectorUpdatedAt updated_at status');

    if (!profile) return false;

    // Don't vectorize non-verified profiles
    if (profile.status !== 'VERIFIED') return false;

    // No vector exists (use type assertion)
    if (!(profile as any).profileVector || (profile as any).profileVector.length === 0) {
      return true;
    }

    // Vector is outdated (profile updated after vector)
    if ((profile as any).vectorUpdatedAt && profile.updated_at) {
      const vectorAge = profile.updated_at.getTime() - (profile as any).vectorUpdatedAt.getTime();
      return vectorAge > 1000 * 60 * 60 * 24; // 24 hours
    }

    return false;
  }
}

export const profileVectorizationService = new ProfileVectorizationService();
