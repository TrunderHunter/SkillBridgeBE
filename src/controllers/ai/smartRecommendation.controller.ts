import { Request, Response } from 'express';
import { smartRecommendationService } from '../../services/ai/smartRecommendation.service';
import { smartStudentRecommendationService } from '../../services/ai/smartStudentRecommendation.service';
import { profileVectorizationService } from '../../services/ai/profileVectorization.service';
import { studentPostVectorizationService } from '../../services/ai/studentPostVectorization.service';
import { sendSuccess, sendError } from '../../utils/response';
import { logger } from './../../utils/logger';

export class SmartRecommendationController {
  /**
   * Get smart tutor recommendations for a student post
   * POST /api/v1/posts/:postId/smart-recommendations
   */
  static async getSmartRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = req.user!.id;

      const {
        limit = 10,
        minScore = 0.5,
        includeExplanations = true
      } = req.query;

      logger.info(`🎯 Getting smart recommendations for post: ${postId}`);

      const recommendations = await smartRecommendationService.getRecommendations(
        postId,
        {
          limit: parseInt(limit as string),
          minScore: parseFloat(minScore as string),
          includeExplanations: includeExplanations === 'true'
        }
      );

      // Format response
      const formattedRecs = recommendations.map(rec => ({
        tutorId: rec.tutorId,
        matchScore: Math.round(rec.matchScore * 100), // Convert to percentage
        explanation: rec.explanation,
        tutor: {
          name: rec.tutorPost.tutorId.full_name,
          email: rec.tutorPost.tutorId.email,
          phone: rec.tutorPost.tutorId.phone_number,
          avatar: rec.tutorPost.tutorId.avatar_url,
          headline: rec.tutorProfile.headline,
          introduction: rec.tutorProfile.introduction?.substring(0, 200), // Truncate
          rating: {
            average: rec.tutorProfile?.ratingAverage || 0,
            count: rec.tutorProfile?.ratingCount || 0,
            badges: rec.tutorProfile?.badges || [],
            lastReviewAt: rec.tutorProfile?.lastReviewAt || null,
          },
        },
        tutorPost: {
          id: rec.tutorPost._id,
          title: rec.tutorPost.title,
          description: rec.tutorPost.description?.substring(0, 200), // Truncate
          subjects: rec.tutorPost.subjects,
          pricePerSession: rec.tutorPost.pricePerSession,
          sessionDuration: rec.tutorPost.sessionDuration,
          teachingMode: rec.tutorPost.teachingMode,
          studentLevel: rec.tutorPost.studentLevel,
        },
        matchDetails: rec.matchDetails,
      }));

      sendSuccess(res, 'Tìm thấy các gợi ý phù hợp', {
        total: formattedRecs.length,
        recommendations: formattedRecs,
      });

    } catch (error: any) {
      logger.error('❌ Smart recommendation controller error:', error);
      sendError(
        res,
        error.message || 'Không thể tạo gợi ý thông minh',
        undefined,
        500
      );
    }
  }

  /**
   * Trigger vectorization for a tutor profile
   * POST /api/v1/tutors/profile/vectorize
   */
  static async vectorizeProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      logger.info(`🔄 Vectorizing profile for user: ${userId}`);

      // Find tutor profile
      const { TutorProfile } = await import('../../models/TutorProfile');
      const profile = await TutorProfile.findOne({ user_id: userId });

      if (!profile) {
        return sendError(res, 'Không tìm thấy hồ sơ gia sư', undefined, 404);
      }

      const success = await profileVectorizationService.vectorizeTutorProfile(
        profile._id
      );

      if (success) {
        sendSuccess(res, 'Cập nhật vector thành công', {
          profileId: profile._id,
          vectorUpdatedAt: new Date(),
        });
      } else {
        sendError(res, 'Không thể cập nhật vector', undefined, 500);
      }

    } catch (error: any) {
      logger.error('❌ Vectorize profile controller error:', error);
      sendError(
        res,
        error.message || 'Lỗi khi cập nhật vector',
        undefined,
        500
      );
    }
  }

  /**
   * Admin: Batch vectorize all verified profiles
   * POST /api/v1/admin/tutors/vectorize-all
   */
  static async batchVectorizeProfiles(req: Request, res: Response): Promise<void> {
    try {
      logger.info('🔄 Starting batch vectorization (admin)');

      const result = await profileVectorizationService.vectorizeAllVerifiedProfiles();

      sendSuccess(res, 'Hoàn thành vectorization', {
        success: result.success,
        failed: result.failed,
        total: result.success + result.failed,
      });

    } catch (error: any) {
      logger.error('❌ Batch vectorize controller error:', error);
      sendError(
        res,
        error.message || 'Lỗi khi vectorize profiles',
        undefined,
        500
      );
    }
  }

  /**
   * Check if Gemini AI service is available
   * GET /api/v1/ai/status
   */
  static async checkAIStatus(req: Request, res: Response): Promise<void> {
    try {
      const { geminiService } = await import('../../services/ai/gemini.service');
      const { TutorProfile } = await import('../../models/TutorProfile');
      const { TutorPost } = await import('../../models/TutorPost');

      const isAvailable = geminiService.isAvailable();

      // Count vectorized profiles
      const vectorizedCount = await TutorProfile.countDocuments({
        profileVector: { $exists: true, $ne: null }
      });

      // Count total and active tutor posts
      const totalPosts = await TutorPost.countDocuments();
      const activePosts = await TutorPost.countDocuments({ status: 'ACTIVE' });

      sendSuccess(res, 'AI service status', {
        geminiAvailable: isAvailable,
        vectorizedProfiles: vectorizedCount,
        tutorPosts: {
          total: totalPosts,
          active: activePosts,
        },
        features: {
          smartRecommendations: isAvailable,
          semanticSearch: isAvailable,
          matchExplanations: isAvailable,
        },
      });

    } catch (error: any) {
      logger.error('❌ AI status check error:', error);
      sendError(res, error.message || 'Lỗi khi kiểm tra AI status', undefined, 500);
    }
  }

  /**
   * Debug: Check what filters are applied for a post
   * GET /api/v1/ai/posts/:postId/debug-filters
   */
  static async debugFilters(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const { Post } = await import('../../models/Post');
      const { TutorPost } = await import('../../models/TutorPost');

      // Get student post
      const studentPost = await Post.findById(postId)
        .populate('subjects', 'name')
        .lean();

      if (!studentPost) {
        return sendError(res, 'Không tìm thấy bài đăng', undefined, 404);
      }

      // Build filters (copy logic from service)
      const filters: any = {
        status: 'ACTIVE',
      };

      if (studentPost.subjects && studentPost.subjects.length > 0) {
        const subjectIds = studentPost.subjects.map((s: any) =>
          typeof s === 'string' ? s : s._id
        );
        filters.subjects = { $in: subjectIds };
      }

      if (studentPost.grade_levels && studentPost.grade_levels.length > 0) {
        filters.studentLevel = { $in: studentPost.grade_levels };
      }

      if (studentPost.hourly_rate) {
        const { min, max } = studentPost.hourly_rate;
        if (min !== undefined || max !== undefined) {
          filters.pricePerSession = {};
          if (min !== undefined) filters.pricePerSession.$gte = min;
          if (max !== undefined) filters.pricePerSession.$lte = max;
        }
      }

      // Count matches
      const totalActive = await TutorPost.countDocuments({ status: 'ACTIVE' });
      const matchingCount = await TutorPost.countDocuments(filters);

      // Get sample matches
      const sampleMatches = await TutorPost.find(filters)
        .populate('subjects', 'name')
        .limit(3)
        .lean();

      sendSuccess(res, 'Debug info', {
        studentPost: {
          id: studentPost._id,
          subjects: studentPost.subjects,
          grade_levels: studentPost.grade_levels,
          hourly_rate: studentPost.hourly_rate,
          is_online: studentPost.is_online,
        },
        filters,
        results: {
          totalActivePosts: totalActive,
          matchingPosts: matchingCount,
          sampleMatches: sampleMatches.map(p => ({
            id: p._id,
            subjects: p.subjects,
            studentLevel: p.studentLevel,
            pricePerSession: p.pricePerSession,
            teachingMode: p.teachingMode,
          })),
        },
      });

    } catch (error: any) {
      logger.error('❌ Debug filters error:', error);
      sendError(res, error.message || 'Lỗi khi debug', undefined, 500);
    }
  }

  /**
   * Get smart student post recommendations for a tutor
   * GET /api/v1/ai/tutors/:tutorId/smart-student-posts
   */
  static async getSmartStudentRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const { tutorId } = req.params;
      const userId = req.user!.id;

      // Verify tutor can only get their own recommendations
      if (tutorId !== userId) {
        return sendError(res, 'Bạn chỉ có thể xem gợi ý cho chính mình', undefined, 403);
      }

      const {
        limit = 10,
        minScore = 0.5,
        includeExplanations = true
      } = req.query;

      logger.info(`🎯 Getting smart student recommendations for tutor: ${tutorId}`);

      const recommendations = await smartStudentRecommendationService.getRecommendations(
        tutorId,
        {
          limit: parseInt(limit as string),
          minScore: parseFloat(minScore as string),
          includeExplanations: includeExplanations === 'true'
        }
      );

      // Format response
      const formattedRecs = recommendations.map(rec => ({
        postId: rec.postId,
        matchScore: Math.round(rec.matchScore * 100), // Convert to percentage
        explanation: rec.explanation,
        studentPost: {
          id: rec.studentPost._id,
          title: rec.studentPost.title,
          content: rec.studentPost.content?.substring(0, 200), // Truncate
          subjects: rec.studentPost.subjects,
          grade_levels: rec.studentPost.grade_levels,
          hourly_rate: rec.studentPost.hourly_rate,
          is_online: rec.studentPost.is_online,
          location: rec.studentPost.location,
          requirements: rec.studentPost.requirements,
          availability: rec.studentPost.availability,
          author: {
            name: rec.studentPost.author_id?.full_name,
            email: rec.studentPost.author_id?.email,
            phone: rec.studentPost.author_id?.phone_number,
            avatar: rec.studentPost.author_id?.avatar_url,
          },
        },
        matchDetails: rec.matchDetails,
      }));

      sendSuccess(res, 'Tìm thấy các bài đăng phù hợp', {
        total: formattedRecs.length,
        recommendations: formattedRecs,
      });

    } catch (error: any) {
      logger.error('❌ Smart student recommendation controller error:', error);
      sendError(
        res,
        error.message || 'Không thể tạo gợi ý thông minh',
        undefined,
        500
      );
    }
  }

  /**
   * Trigger vectorization for a student post
   * POST /api/v1/ai/posts/:postId/vectorize
   */
  static async vectorizeStudentPost(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = req.user!.id;

      // Get post to verify ownership
      const { Post } = await import('../../models/Post');
      const post = await Post.findById(postId);

      if (!post) {
        return sendError(res, 'Không tìm thấy bài đăng', undefined, 404);
      }

      // Only author or admin can vectorize
      if (post.author_id.toString() !== userId && req.user!.role !== 'admin') {
        return sendError(res, 'Bạn không có quyền vectorize bài đăng này', undefined, 403);
      }

      logger.info(`🔄 Vectorizing student post: ${postId}`);

      const success = await studentPostVectorizationService.vectorizeStudentPost(postId);

      if (success) {
        sendSuccess(res, 'Cập nhật vector thành công', {
          postId,
          vectorUpdatedAt: new Date(),
        });
      } else {
        sendError(res, 'Không thể cập nhật vector', undefined, 500);
      }

    } catch (error: any) {
      logger.error('❌ Vectorize student post controller error:', error);
      sendError(
        res,
        error.message || 'Lỗi khi cập nhật vector',
        undefined,
        500
      );
    }
  }

  /**
   * Admin: Batch vectorize all approved student posts
   * POST /api/v1/ai/admin/posts/vectorize-all
   */
  static async batchVectorizeStudentPosts(req: Request, res: Response): Promise<void> {
    try {
      logger.info('🔄 Starting batch vectorization for student posts (admin)');

      const result = await studentPostVectorizationService.vectorizeAllApprovedPosts();

      sendSuccess(res, 'Hoàn thành vectorization', {
        success: result.success,
        failed: result.failed,
        total: result.success + result.failed,
      });

    } catch (error: any) {
      logger.error('❌ Batch vectorize student posts controller error:', error);
      sendError(
        res,
        error.message || 'Lỗi khi vectorize posts',
        undefined,
        500
      );
    }
  }

  /**
   * Generate AI explanation for why a student post matches a tutor post
   * POST /api/v1/ai/explain-match
   */
  static async generateMatchExplanation(req: Request, res: Response): Promise<void> {
    try {
      const { tutorPostId, studentPostId, matchScore } = req.body;

      if (!tutorPostId || !studentPostId) {
        return sendError(res, 'tutorPostId và studentPostId là bắt buộc', undefined, 400);
      }

      const matchScoreNum = matchScore ? parseFloat(matchScore as string) : 0.5;

      // Get tutor post
      const { TutorPost } = await import('../../models/TutorPost');
      const tutorPost = await TutorPost.findById(tutorPostId)
        .populate('subjects', 'name')
        .populate('tutorId', 'full_name')
        .lean();

      if (!tutorPost) {
        return sendError(res, 'Không tìm thấy bài đăng gia sư', undefined, 404);
      }

      // Get tutor profile
      const { TutorProfile } = await import('../../models/TutorProfile');
      const tutorProfile = await TutorProfile.findOne({ user_id: tutorPost.tutorId })
        .lean();

      // Get student post
      const { Post } = await import('../../models/Post');
      const studentPost = await Post.findById(studentPostId)
        .populate('subjects', 'name')
        .lean();

      if (!studentPost) {
        return sendError(res, 'Không tìm thấy bài đăng học viên', undefined, 404);
      }

      // Build tutor summary
      const tutorSummary = {
        headline: tutorProfile?.headline || tutorPost.title || '',
        introduction: tutorProfile?.introduction?.substring(0, 200) || tutorPost.description?.substring(0, 200) || '',
        teaching_experience: tutorProfile?.teaching_experience?.substring(0, 200) || '',
        subjects: tutorPost.subjects || [],
      };

      // Build student post data
      const studentPostData = {
        title: studentPost.title,
        content: studentPost.content?.substring(0, 200) || '',
        subjects: studentPost.subjects || [],
        grade_levels: studentPost.grade_levels || [],
        requirements: studentPost.requirements || '',
      };

      // Generate explanation using AI
      const { geminiService } = await import('../../services/ai/gemini.service');
      const explanation = await geminiService.generateStudentMatchExplanation(
        tutorSummary,
        studentPostData,
        matchScoreNum
      );

      sendSuccess(res, 'Đã tạo giải thích AI', {
        explanation,
        matchScore: matchScoreNum,
      });

    } catch (error: any) {
      logger.error('❌ Generate match explanation error:', error);
      sendError(
        res,
        error.message || 'Không thể tạo giải thích AI',
        undefined,
        500
      );
    }
  }
}
