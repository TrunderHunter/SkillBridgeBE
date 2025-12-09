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
      const formattedRecs = recommendations.map(rec => {
        const tutorUser = rec.tutorPost?.tutorId;
        const tutorProfile = rec.tutorProfile || {};
        const tutorPost = rec.tutorPost || {};

        return {
          tutorId: rec.tutorId,
          matchScore: Math.round(rec.matchScore * 100), // Convert to percentage
          explanation: rec.explanation,
          tutor: {
            name: tutorUser?.full_name || 'Gia sư ẩn danh',
            email: tutorUser?.email || '',
            phone: tutorUser?.phone_number || '',
            avatar: tutorUser?.avatar_url || '',
            headline: tutorProfile.headline || '',
            introduction: tutorProfile.introduction?.substring(0, 200) || '',
            rating: {
              average: tutorProfile?.ratingAverage ?? 0,
              count: tutorProfile?.ratingCount ?? 0,
              badges: tutorProfile?.badges ?? [],
              lastReviewAt: tutorProfile?.lastReviewAt ?? null,
            },
          },
          tutorPost: {
            id: tutorPost._id || '',
            title: tutorPost.title || 'Thông tin bài đăng không khả dụng',
            description: tutorPost.description?.substring(0, 200) || '',
            subjects: tutorPost.subjects || [],
            pricePerSession: tutorPost.pricePerSession ?? 0,
            sessionDuration: tutorPost.sessionDuration ?? 60,
            teachingMode: tutorPost.teachingMode || 'ONLINE',
            studentLevel: tutorPost.studentLevel || [],
          },
          matchDetails: {
            subjectMatch: !!rec.matchDetails?.subjectMatch,
            levelMatch: !!rec.matchDetails?.levelMatch,
            priceMatch: !!rec.matchDetails?.priceMatch,
            scheduleMatch: !!rec.matchDetails?.scheduleMatch,
            semanticScore: rec.matchDetails?.semanticScore ?? 0,
          },
        };
      });

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
   * Generate AI explanation for a specific tutor-post match (ON-DEMAND)
   * GET /api/v1/ai/tutors/:tutorId/posts/:postId/explanation
   * 
   * This is the recommended way to get match explanations.
   * Only generate when user actually clicks on a tutor (not for all 10 results).
   * 
   * Cost: ~25 VNĐ per call
   * Savings: 90% compared to auto-generating for all 10 tutors
   */
  static async getOnDemandExplanation(req: Request, res: Response): Promise<void> {
    try {
      const { tutorId, postId } = req.params;
      const userId = req.user!.id;

      logger.info(`🔍 On-demand explanation request: tutor=${tutorId}, post=${postId}`);

      // Verify post belongs to user
      const { Post } = await import('../../models/Post');
      const post = await Post.findById(postId);
      
      if (!post) {
        return sendError(res, 'Không tìm thấy bài đăng', undefined, 404);
      }

      if (post.author_id !== userId) {
        return sendError(res, 'Không có quyền truy cập bài đăng này', undefined, 403);
      }

      // Generate explanation
      const explanation = await smartRecommendationService.generateSingleExplanation(
        postId,
        tutorId
      );

      sendSuccess(res, 'Tạo giải thích thành công', {
        tutorId,
        postId,
        explanation,
        generatedAt: new Date(),
      });

    } catch (error: any) {
      logger.error('❌ On-demand explanation error:', error);
      sendError(
        res,
        error.message || 'Không thể tạo giải thích',
        undefined,
        500
      );
    }
  }

  /**
   * Generate AI explanation for a specific student-tutor post match (ON-DEMAND) - FOR TUTOR
   * GET /api/v1/ai/tutor-posts/:tutorPostId/student-posts/:studentPostId/explanation
   * 
   * This is the recommended way to get match explanations for tutors.
   * Only generate when tutor actually clicks on a student post (not for all results).
   * 
   * Cost: ~25 VNĐ per call
   * Savings: 90% compared to auto-generating for all recommendations
   */
  static async getOnDemandStudentExplanation(req: Request, res: Response): Promise<void> {
    try {
      const { tutorPostId, studentPostId } = req.params;
      const userId = req.user!.id;

      logger.info(`🔍 On-demand student explanation request: tutorPost=${tutorPostId}, studentPost=${studentPostId}`);

      // Verify tutor post belongs to user
      const { TutorPost } = await import('../../models/TutorPost');
      const tutorPost = await TutorPost.findById(tutorPostId)
        .populate('subjects', 'name')
        .lean();
      
      if (!tutorPost) {
        return sendError(res, 'Không tìm thấy bài đăng gia sư', undefined, 404);
      }

      if (tutorPost.tutorId.toString() !== userId) {
        return sendError(res, 'Không có quyền truy cập bài đăng này', undefined, 403);
      }

      // Get tutor profile for additional context
      const { TutorProfile } = await import('../../models/TutorProfile');
      const tutorProfile = await TutorProfile.findOne({ user_id: userId }).lean();

      // Get student post
      const { Post } = await import('../../models/Post');
      const studentPost = await Post.findById(studentPostId)
        .populate('subjects', 'name')
        .lean();

      if (!studentPost) {
        return sendError(res, 'Không tìm thấy bài đăng học viên', undefined, 404);
      }

      // Build tutor summary with full context
      const tutorSummary = {
        headline: tutorProfile?.headline || tutorPost.title || '',
        introduction: tutorProfile?.introduction || tutorPost.description || '',
        teaching_experience: tutorProfile?.teaching_experience || '',
        subjects: tutorPost.subjects || [],
        pricePerSession: tutorPost.pricePerSession,
        teachingMode: tutorPost.teachingMode,
        studentLevel: tutorPost.studentLevel || [],
      };

      // Build student post data with full details
      const studentPostData = {
        title: studentPost.title,
        content: studentPost.content || '',
        subjects: studentPost.subjects || [],
        grade_levels: studentPost.grade_levels || [],
        requirements: studentPost.requirements || '',
        hourly_rate: studentPost.hourly_rate,
        is_online: studentPost.is_online,
      };

      // Calculate match details
      const matchDetails = {
        subjectMatch: tutorPost.subjects?.some((ts: any) =>
          studentPost.subjects?.some((ss: any) =>
            (typeof ts === 'object' ? ts.name : ts) === (typeof ss === 'object' ? ss.name : ss)
          )
        ) ? 100 : 0,
        levelMatch: tutorPost.studentLevel?.some((level: string) =>
          studentPost.grade_levels?.includes(level)
        ) ? 100 : 0,
        priceMatch:
          studentPost.hourly_rate &&
          tutorPost.pricePerSession &&
          tutorPost.pricePerSession >= (studentPost.hourly_rate.min || 0) &&
          tutorPost.pricePerSession <= (studentPost.hourly_rate.max || Number.MAX_SAFE_INTEGER)
            ? 100
            : 0,
        modeMatch:
          tutorPost.teachingMode === 'BOTH' ||
          (studentPost.is_online && tutorPost.teachingMode === 'ONLINE') ||
          (!studentPost.is_online && tutorPost.teachingMode === 'OFFLINE')
            ? 100
            : 30,
      };

      // Calculate overall match score
      const matchScore = (matchDetails.subjectMatch * 0.4 + matchDetails.levelMatch * 0.25 + 
                         matchDetails.priceMatch * 0.2 + matchDetails.modeMatch * 0.15) / 100;

      // Try AI explanation first, fallback to rule-based if quota exceeded
      let explanation: string;
      let usedAI = false;

      try {
        const { geminiService } = await import('../../services/ai/gemini.service');
        
        // DEBUG: Check Gemini availability
        logger.info('🔍 [DEBUG] Checking Gemini service...');
        logger.info(`🔍 [DEBUG] GEMINI_API_KEY exists: ${!!process.env.GEMINI_API_KEY}`);
        logger.info(`🔍 [DEBUG] GEMINI_API_KEY length: ${process.env.GEMINI_API_KEY?.length || 0}`);
        logger.info(`🔍 [DEBUG] geminiService.isAvailable(): ${geminiService.isAvailable()}`);
        
        logger.info('🤖 [getOnDemandStudentExplanation] Calling geminiService.generateStudentMatchExplanation');
        logger.info('🔍 [DEBUG] tutorSummary:', JSON.stringify(tutorSummary, null, 2));
        logger.info('🔍 [DEBUG] studentPostData:', JSON.stringify(studentPostData, null, 2));
        logger.info('🔍 [DEBUG] matchScore:', matchScore);
        logger.info('🔍 [DEBUG] matchDetails:', JSON.stringify(matchDetails, null, 2));
        
        explanation = await geminiService.generateStudentMatchExplanation(
          tutorSummary,
          studentPostData,
          matchScore,
          matchDetails
        );

        usedAI = true;
        logger.info(`✅ [getOnDemandStudentExplanation] AI explanation generated (cost: ~25 VNĐ):`, {
          explanationLength: explanation.length,
          preview: explanation.substring(0, 100),
        });
      } catch (aiError: any) {
        // AI failed (quota/429/etc) - fallback to rule-based
        logger.error('❌ [DEBUG] AI explanation FAILED with error:', {
          name: aiError.name,
          message: aiError.message,
          stack: aiError.stack?.substring(0, 500),
        });
        
        const { smartRecommendationService } = await import('../../services/ai/smartRecommendation.service');
        explanation = smartRecommendationService.generateDetailedStudentExplanation(
          studentPostData,
          tutorPost,
          matchDetails,
          matchScore
        );

        logger.info(`✅ [getOnDemandStudentExplanation] Rule-based explanation generated (free)`);
      }

      sendSuccess(res, usedAI ? 'Tạo giải thích AI thành công' : 'Tạo giải thích thành công', {
        tutorPostId,
        studentPostId,
        explanation,
        matchScore: Math.round(matchScore * 100),
        usedAI,
        generatedAt: new Date(),
      });

    } catch (error: any) {
      logger.error('❌ On-demand student explanation error:', error);
      sendError(
        res,
        error.message || 'Không thể tạo giải thích',
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

      logger.info(`🤖 [generateMatchExplanation] Request received:`, {
        tutorPostId,
        studentPostId,
        matchScore,
      });

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

      // Build tutor summary with full context
      const tutorSummary = {
        headline: tutorProfile?.headline || tutorPost.title || '',
        introduction: tutorProfile?.introduction || tutorPost.description || '',
        teaching_experience: tutorProfile?.teaching_experience || '',
        subjects: tutorPost.subjects || [],
        pricePerSession: tutorPost.pricePerSession,
        teachingMode: tutorPost.teachingMode,
      };

      // Build student post data with full details
      const studentPostData = {
        title: studentPost.title,
        content: studentPost.content || '',
        subjects: studentPost.subjects || [],
        grade_levels: studentPost.grade_levels || [],
        requirements: studentPost.requirements || '',
        hourly_rate: studentPost.hourly_rate,
        is_online: studentPost.is_online,
      };

      // Calculate match details
      const matchDetails = {
        subjectMatch: tutorPost.subjects?.some((ts: any) =>
          studentPost.subjects?.some((ss: any) =>
            (typeof ts === 'object' ? ts.name : ts) === (typeof ss === 'object' ? ss.name : ss)
          )
        ) ? 100 : 0,
        levelMatch: tutorPost.studentLevel?.some((level: string) =>
          studentPost.grade_levels?.includes(level)
        ) ? 100 : 0,
        priceMatch:
          studentPost.hourly_rate &&
          tutorPost.pricePerSession &&
          tutorPost.pricePerSession >= (studentPost.hourly_rate.min || 0) &&
          tutorPost.pricePerSession <= (studentPost.hourly_rate.max || Number.MAX_SAFE_INTEGER)
            ? 100
            : 0,
        modeMatch:
          tutorPost.teachingMode === 'BOTH' ||
          (studentPost.is_online && tutorPost.teachingMode === 'ONLINE') ||
          (!studentPost.is_online && tutorPost.teachingMode === 'OFFLINE')
            ? 100
            : 30,
      };

      // Try AI explanation first, fallback to rule-based if quota exceeded
      let explanation: string;
      let usedAI = false;

      try {
        const { geminiService } = await import('../../services/ai/gemini.service');
        
        logger.info('🤖 [generateMatchExplanation] Calling geminiService.generateStudentMatchExplanation');
        logger.info('📊 Match details:', matchDetails);
        
        explanation = await geminiService.generateStudentMatchExplanation(
          tutorSummary,
          studentPostData,
          matchScoreNum,
          matchDetails
        );

        usedAI = true;
        logger.info(`✅ [generateMatchExplanation] AI explanation generated (cost: ~25 VNĐ):`, {
          explanationLength: explanation.length,
          preview: explanation.substring(0, 100),
        });
      } catch (aiError: any) {
        // AI failed (quota/429/etc) - fallback to rule-based
        logger.warn('⚠️ AI explanation failed, using rule-based fallback:', aiError.message);
        
        const { smartRecommendationService } = await import('../../services/ai/smartRecommendation.service');
        explanation = smartRecommendationService.generateDetailedStudentExplanation(
          studentPostData,
          tutorPost,
          matchDetails,
          matchScoreNum
        );

        logger.info(`✅ [generateMatchExplanation] Rule-based explanation generated (free):`, {
          explanationLength: explanation.length,
          preview: explanation.substring(0, 100),
        });
      }

      sendSuccess(res, usedAI ? 'Đã tạo giải thích AI' : 'Đã tạo giải thích', {
        explanation,
        matchScore: matchScoreNum,
        usedAI,
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
