import { Post } from '../../models/Post';
import { TutorPost } from '../../models/TutorPost';
import { TutorProfile } from '../../models/TutorProfile';
import { User } from '../../models/User';
import { Subject } from '../../models/Subject';
import { geminiService } from './gemini.service';
import { logger } from './../../utils/logger';

/**
 * Map student grade levels to tutor student level enums
 */
const GRADE_LEVEL_MAPPING: { [key: string]: string[] } = {
  'Lớp 1': ['TIEU_HOC'],
  'Lớp 2': ['TIEU_HOC'],
  'Lớp 3': ['TIEU_HOC'],
  'Lớp 4': ['TIEU_HOC'],
  'Lớp 5': ['TIEU_HOC'],
  'Lớp 6': ['TRUNG_HOC_CO_SO'],
  'Lớp 7': ['TRUNG_HOC_CO_SO'],
  'Lớp 8': ['TRUNG_HOC_CO_SO'],
  'Lớp 9': ['TRUNG_HOC_CO_SO'],
  'Lớp 10': ['TRUNG_HOC_PHO_THONG'],
  'Lớp 11': ['TRUNG_HOC_PHO_THONG'],
  'Lớp 12': ['TRUNG_HOC_PHO_THONG'],
  'Đại học': ['DAI_HOC'],
  'Người đi làm': ['NGUOI_DI_LAM'],
};

/**
 * Interface for smart recommendation result
 */
export interface ISmartRecommendation {
  tutorId: string;
  tutorPost: any;
  tutorProfile: any;
  matchScore: number;
  explanation: string;
  matchDetails: {
    subjectMatch: boolean;
    levelMatch: boolean;
    priceMatch: boolean;
    scheduleMatch: boolean;
    semanticScore: number;
  };
}

/**
 * Interface for recommendation options
 */
export interface IRecommendationOptions {
  limit?: number;
  minScore?: number;
  includeExplanations?: boolean;
}

/**
 * Smart Recommendation Service
 * Implements hybrid search: filtering + vector semantic search
 */
class SmartRecommendationService {
  /**
   * Get smart tutor recommendations for a student post
   * @param studentPostId - ID of student's post
   * @param options - Recommendation options
   */
  async getRecommendations(
    studentPostId: string,
    options: IRecommendationOptions = {}
  ): Promise<ISmartRecommendation[]> {
    const {
      limit = 10,
      minScore = 0.5,
      includeExplanations = true
    } = options;

    try {
      // Step 1: Get student post
      const studentPost = await Post.findById(studentPostId)
        .populate('subjects', 'name')
        .lean();

      if (!studentPost) {
        throw new Error('Student post not found');
      }

      logger.info(`🔍 Finding recommendations for post: ${studentPostId}`);

      // Step 2: Build structured filters (Hard filtering)
      const filters = await this.buildStructuredFilters(studentPost);

      // Step 3: Get matching tutor posts with filters
      const candidateTutorPosts = await this.getCandidateTutors(filters);

      if (candidateTutorPosts.length === 0) {
        logger.info('❌ No tutors match the hard filters');
        return [];
      }

      logger.info(`✅ Found ${candidateTutorPosts.length} candidate tutors after filtering`);

      // Step 4: Generate query vector for semantic search (WITH CACHING)
      let queryVector: number[] | null = null;

      // Check if we have cached vector and if post hasn't been updated since
      if (studentPost.postVector && studentPost.vectorUpdatedAt) {
        const postUpdatedAt = new Date(studentPost.updated_at || studentPost.created_at || Date.now());
        const vectorUpdatedAt = new Date(studentPost.vectorUpdatedAt);
        
        if (vectorUpdatedAt >= postUpdatedAt) {
          // Use cached vector
          queryVector = studentPost.postVector;
          logger.info('✅ Using cached query vector (cost saved: $0.000125)');
        }
      }

      // Generate new vector only if cache miss or outdated
      if (!queryVector && geminiService.isAvailable()) {
        try {
          const queryText = this.buildQueryText(studentPost);
          queryVector = await geminiService.getEmbedding(queryText);
          logger.info('✅ Query vector generated (cost: $0.000125)');

          // Cache the vector in database for future use
          await Post.updateOne(
            { _id: studentPostId },
            {
              postVector: queryVector,
              vectorUpdatedAt: new Date()
            }
          );
          logger.info('💾 Query vector cached in database');
        } catch (error) {
          logger.warn('⚠️ Failed to generate query vector, using filter-only mode');
        }
      }

      // Step 5: Calculate match scores
      const recommendations = await this.calculateMatchScores(
        studentPost,
        candidateTutorPosts,
        queryVector
      );

      // Step 6: Filter by minimum score and sort
      const filteredRecs = recommendations
        .filter(rec => rec.matchScore >= minScore)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit);

      // Step 7: Generate explanations if requested (NOT RECOMMENDED - use on-demand instead)
      // For backward compatibility, still support includeExplanations param
      // But recommend using GET /ai/tutors/:tutorId/posts/:postId/explanation instead
      if (includeExplanations && geminiService.isAvailable()) {
        logger.warn('⚠️ Auto-generating explanations (expensive). Consider on-demand API instead.');
        await this.addExplanations(studentPost, filteredRecs);
      } else if (includeExplanations) {
        // Set placeholder - frontend should call on-demand API
        filteredRecs.forEach(rec => {
          rec.explanation = ''; // Empty - frontend will fetch on-demand
        });
      }

      logger.info(`✅ Returning ${filteredRecs.length} recommendations`);

      return filteredRecs;

    } catch (error: any) {
      logger.error('❌ Smart recommendation error:', error);
      throw new Error(`Failed to generate recommendations: ${error.message}`);
    }
  }

  /**
   * Build structured filters from student post
   */
  private async buildStructuredFilters(studentPost: any): Promise<any> {
    const filters: any = {
      status: 'ACTIVE', // Only active posts
    };

    // Subject filter - Convert subject names to IDs if needed
    if (studentPost.subjects && studentPost.subjects.length > 0) {
      // Check if subjects are already ObjectIds or names
      const firstSubject = studentPost.subjects[0];
      
      if (typeof firstSubject === 'string' && firstSubject.length === 24) {
        // Already ObjectId strings
        filters.subjects = { $in: studentPost.subjects };
      } else if (typeof firstSubject === 'object' && firstSubject._id) {
        // Populated subject objects
        const subjectIds = studentPost.subjects.map((s: any) => s._id.toString());
        filters.subjects = { $in: subjectIds };
      } else {
        // Subject names - need to convert to IDs
        const subjectNames = studentPost.subjects.map((s: any) => 
          typeof s === 'string' ? s : s.name || s
        );
        
        // Find subject IDs by names
        const subjectDocs = await Subject.find({ 
          name: { $in: subjectNames } 
        }).select('_id').lean();
        
        if (subjectDocs.length > 0) {
          const subjectIds = subjectDocs.map(s => s._id.toString());
          filters.subjects = { $in: subjectIds };
          logger.info(`📚 Converted subjects: ${subjectNames} → ${subjectIds}`);
        } else {
          logger.warn(`⚠️ No subjects found for names: ${subjectNames}`);
        }
      }
    }

    // Student level filter - Map grade levels to enums
    if (studentPost.grade_levels && studentPost.grade_levels.length > 0) {
      const mappedLevels = new Set<string>();
      
      studentPost.grade_levels.forEach((grade: string) => {
        const levels = GRADE_LEVEL_MAPPING[grade];
        if (levels) {
          levels.forEach(level => mappedLevels.add(level));
        }
      });
      
      if (mappedLevels.size > 0) {
        filters.studentLevel = { $in: Array.from(mappedLevels) };
        logger.info(`📖 Mapped grades: ${studentPost.grade_levels} → ${Array.from(mappedLevels)}`);
      }
    }

    // Price filter
    if (studentPost.hourly_rate) {
      const { min, max } = studentPost.hourly_rate;
      if (min !== undefined || max !== undefined) {
        filters.pricePerSession = {};
        if (min !== undefined) filters.pricePerSession.$gte = min;
        if (max !== undefined) filters.pricePerSession.$lte = max;
      }
    }

    // Teaching mode filter
    if (studentPost.is_online !== undefined) {
      if (studentPost.is_online) {
        filters.teachingMode = { $in: ['ONLINE', 'BOTH'] };
      } else {
        filters.teachingMode = { $in: ['OFFLINE', 'BOTH'] };
      }
    }

    // Location filter (if offline)
    if (studentPost.location && !studentPost.is_online) {
      // This is simplified - you might want more sophisticated location matching
      filters['address.province'] = { $exists: true };
    }

    return filters;
  }

  /**
   * Get candidate tutors that match structured filters
   */
  private async getCandidateTutors(filters: any): Promise<any[]> {
    return await TutorPost.find(filters)
      .populate('tutorId', 'full_name email phone_number avatar_url')
      .populate('subjects', 'name')
      .sort({ 
        'rating.average': -1,  // Ưu tiên rating cao
        'rating.count': -1     // Ưu tiên nhiều review
      })
      .limit(200) // TĂNG từ 100 → 200 để có coverage tốt hơn 50%
      .lean();
  }

  /**
   * Build query text for semantic search
   */
  private buildQueryText(studentPost: any): string {
    const parts: string[] = [];

    // Add subjects
    if (studentPost.subjects && studentPost.subjects.length > 0) {
      const subjectNames = studentPost.subjects.map((s: any) => 
        typeof s === 'object' ? s.name : s
      ).join(', ');
      parts.push(`Môn học: ${subjectNames}`);
    }

    // Add grade levels
    if (studentPost.grade_levels && studentPost.grade_levels.length > 0) {
      parts.push(`Lớp: ${studentPost.grade_levels.join(', ')}`);
    }

    // Add content
    if (studentPost.content) {
      parts.push(studentPost.content);
    }

    // Add requirements
    if (studentPost.requirements) {
      parts.push(`Yêu cầu: ${studentPost.requirements}`);
    }

    return parts.join('. ');
  }

  /**
   * Calculate match scores for each candidate
   */
  private async calculateMatchScores(
    studentPost: any,
    candidateTutors: any[],
    queryVector: number[] | null
  ): Promise<ISmartRecommendation[]> {
    const recommendations: ISmartRecommendation[] = [];

    for (const tutorPost of candidateTutors) {
      try {
        // Get tutor profile
        const tutorProfile = await TutorProfile.findOne({
          user_id: tutorPost.tutorId._id
        }).lean();

        if (!tutorProfile) continue;

        // Calculate structured match
        const structuredScore = this.calculateStructuredMatch(studentPost, tutorPost);

        // Calculate semantic match if vector available (use type assertion)
        let semanticScore = 0;
        if (queryVector && (tutorProfile as any).profileVector) {
          semanticScore = geminiService.cosineSimilarity(
            queryVector,
            (tutorProfile as any).profileVector
          );
        }

        // Combined score (70% structured, 30% semantic)
        const matchScore = (structuredScore * 0.7) + (semanticScore * 0.3);

        // Build match details
        const matchDetails = this.buildMatchDetails(
          studentPost,
          tutorPost,
          semanticScore
        );

        recommendations.push({
          tutorId: tutorPost.tutorId._id.toString(),
          tutorPost,
          tutorProfile,
          matchScore,
          explanation: '', // Will be filled later if needed
          matchDetails
        });

      } catch (error) {
        logger.error(`Error processing tutor ${tutorPost._id}:`, error);
      }
    }

    return recommendations;
  }

  /**
   * Calculate structured match score (0-1)
   */
  private calculateStructuredMatch(studentPost: any, tutorPost: any): number {
    let score = 0;
    let factors = 0;

    // Subject match (weight: 0.4) - TĂNG từ 0.3 → 0.4 (quan trọng nhất)
    if (studentPost.subjects && tutorPost.subjects) {
      const studentSubjects = new Set(
        studentPost.subjects.map((s: any) => 
          typeof s === 'object' ? s._id.toString() : s.toString()
        )
      );
      const tutorSubjects = new Set(
        tutorPost.subjects.map((s: any) => 
          typeof s === 'object' ? s._id.toString() : s.toString()
        )
      );

      const intersection = [...studentSubjects].filter(s => tutorSubjects.has(s));
      const matchRatio = intersection.length / studentSubjects.size;
      score += matchRatio * 0.4;
      factors += 0.4;
    }

    // Level match (weight: 0.3) - TĂNG từ 0.25 → 0.3 (rất quan trọng)
    if (studentPost.grade_levels && tutorPost.studentLevel) {
      const hasMatch = studentPost.grade_levels.some((level: string) =>
        tutorPost.studentLevel.includes(level)
      );
      score += (hasMatch ? 1 : 0) * 0.3;
      factors += 0.3;
    }

    // Price match (weight: 0.2) - GIẢM từ 0.25 → 0.2 (có thể thương lượng)
    if (studentPost.hourly_rate && tutorPost.pricePerSession) {
      const { min = 0, max = Infinity } = studentPost.hourly_rate;
      const inRange = tutorPost.pricePerSession >= min && tutorPost.pricePerSession <= max;
      score += (inRange ? 1 : 0) * 0.2;
      factors += 0.2;
    }

    // Teaching mode match (weight: 0.1) - GIẢM từ 0.2 → 0.1 (ít quan trọng nhất)
    if (studentPost.is_online !== undefined && tutorPost.teachingMode) {
      const studentMode = studentPost.is_online ? 'ONLINE' : 'OFFLINE';
      const matches = tutorPost.teachingMode === 'BOTH' || 
                     tutorPost.teachingMode === studentMode;
      score += (matches ? 1 : 0) * 0.1;
      factors += 0.1;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Build detailed match information
   */
  private buildMatchDetails(
    studentPost: any,
    tutorPost: any,
    semanticScore: number
  ): any {
    return {
      subjectMatch: this.checkSubjectMatch(studentPost, tutorPost),
      levelMatch: this.checkLevelMatch(studentPost, tutorPost),
      priceMatch: this.checkPriceMatch(studentPost, tutorPost),
      scheduleMatch: true, // Simplified - can be enhanced
      semanticScore
    };
  }

  private checkSubjectMatch(studentPost: any, tutorPost: any): boolean {
    if (!studentPost.subjects || !tutorPost.subjects) return false;
    
    const studentSubjects = new Set(
      studentPost.subjects.map((s: any) => 
        typeof s === 'object' ? s._id.toString() : s.toString()
      )
    );
    const tutorSubjects = new Set(
      tutorPost.subjects.map((s: any) => 
        typeof s === 'object' ? s._id.toString() : s.toString()
      )
    );

    return [...studentSubjects].some(s => tutorSubjects.has(s));
  }

  private checkLevelMatch(studentPost: any, tutorPost: any): boolean {
    if (!studentPost.grade_levels || !tutorPost.studentLevel) return false;
    
    return studentPost.grade_levels.some((level: string) =>
      tutorPost.studentLevel.includes(level)
    );
  }

  private checkPriceMatch(studentPost: any, tutorPost: any): boolean {
    if (!studentPost.hourly_rate || !tutorPost.pricePerSession) return true;
    
    const { min = 0, max = Infinity } = studentPost.hourly_rate;
    return tutorPost.pricePerSession >= min && tutorPost.pricePerSession <= max;
  }

  /**
   * Add AI-generated explanations to recommendations
   * @deprecated Use generateSingleExplanation instead for on-demand generation
   */
  private async addExplanations(
    studentPost: any,
    recommendations: ISmartRecommendation[]
  ): Promise<void> {
    for (const rec of recommendations) {
      try {
        rec.explanation = await geminiService.generateMatchExplanation(
          studentPost,
          {
            full_name: rec.tutorPost.tutorId.full_name,
            subjects: rec.tutorPost.subjects,
            teaching_experience: rec.tutorProfile.teaching_experience,
            introduction: rec.tutorProfile.introduction
          },
          rec.matchScore
        );
      } catch (error) {
        logger.error('Failed to generate explanation:', error);
        rec.explanation = 'Gia sư phù hợp với yêu cầu của bạn.';
      }
    }
  }

  /**
   * Generate detailed rule-based explanation for tutor match
   * No AI needed - fast and free
   */
  private generateDetailedTutorExplanation(
    studentPost: any,
    tutorInfo: {
      full_name: string;
      subjects: any[];
      teaching_experience?: string;
      introduction?: string;
      grade_levels?: string[];
    },
    matchScore: number
  ): string {
    const reasons: string[] = [];

    // Subject match
    if (studentPost.subjects && tutorInfo.subjects) {
      const studentSubjects = studentPost.subjects.map((s: any) => 
        typeof s === 'object' ? s.name : s
      );
      const tutorSubjects = tutorInfo.subjects.map((s: any) => 
        typeof s === 'object' ? s.name : s
      );
      const matchingSubjects = studentSubjects.filter((s: string) => 
        tutorSubjects.some((ts: string) => ts === s)
      );
      
      if (matchingSubjects.length > 0) {
        reasons.push(`Có kinh nghiệm dạy môn **${matchingSubjects.join(', ')}**`);
      }
    }

    // Grade level match
    if (studentPost.grade_levels && tutorInfo.grade_levels) {
      const matchingLevels = studentPost.grade_levels.filter((l: string) => 
        tutorInfo.grade_levels?.includes(l)
      );
      if (matchingLevels.length > 0) {
        reasons.push(`Phù hợp với cấp độ **${matchingLevels.join(', ')}**`);
      }
    }

    // Teaching experience
    if (tutorInfo.teaching_experience) {
      const years = parseInt(tutorInfo.teaching_experience);
      if (!isNaN(years)) {
        if (years >= 5) {
          reasons.push(`Có **${years} năm** kinh nghiệm giảng dạy`);
        } else if (years >= 2) {
          reasons.push(`Có **${years} năm** kinh nghiệm`);
        }
      }
    }

    // Teaching mode match
    if (studentPost.is_online !== undefined) {
      const mode = studentPost.is_online ? 'Online' : 'Offline';
      reasons.push(`Hình thức học phù hợp (**${mode}**)`);
    }

    // Match score indicator
    if (matchScore >= 0.7) {
      reasons.unshift('**Rất phù hợp** với yêu cầu của bạn');
    } else if (matchScore >= 0.5) {
      reasons.unshift('**Phù hợp** với yêu cầu của bạn');
    }

    // Build explanation
    if (reasons.length === 0) {
      return `${tutorInfo.full_name} có kinh nghiệm giảng dạy phù hợp với yêu cầu của bạn.`;
    }

    return `${tutorInfo.full_name}: ${reasons.join('. ')}.`;
  }

  /**
   * Generate detailed rule-based explanation for student post match (from tutor's perspective)
   * No AI needed - fast and free
   */
  generateDetailedStudentExplanation(
    studentPost: any,
    tutorPost: any,
    matchDetails: any,
    matchScore: number
  ): string {
    const reasons: string[] = [];

    // Subject match
    if (matchDetails?.subjectMatch === 100) {
      const subjectNames = (studentPost.subjects || [])
        .map((s: any) => (typeof s === 'object' ? s.name : s))
        .join(', ');
      reasons.push(`Môn học khớp hoàn toàn (**${subjectNames}**)`);
    } else if (matchDetails?.subjectMatch >= 50) {
      reasons.push('Môn học có phần khớp');
    }

    // Level match
    if (matchDetails?.levelMatch === 100) {
      const levels = (studentPost.grade_levels || []).join(', ');
      reasons.push(`Cấp độ phù hợp (**${levels}**)`);
    } else if (matchDetails?.levelMatch >= 50) {
      reasons.push('Cấp độ tương đối phù hợp');
    }

    // Price match
    if (matchDetails?.priceMatch === 100) {
      const minPrice = studentPost.hourly_rate?.min?.toLocaleString('vi-VN') || '';
      const maxPrice = studentPost.hourly_rate?.max?.toLocaleString('vi-VN') || '';
      if (minPrice && maxPrice) {
        reasons.push(`Mức giá trong khoảng bạn đưa ra (**${minPrice} - ${maxPrice} VNĐ/giờ**)`);
      } else {
        reasons.push('Mức giá phù hợp');
      }
    } else if (matchDetails?.priceMatch >= 50) {
      reasons.push('Mức giá gần với mức bạn đưa ra');
    }

    // Mode match
    if (matchDetails?.modeMatch === 100) {
      const mode = studentPost.is_online ? 'Online' : 'Offline';
      reasons.push(`Hình thức học phù hợp (**${mode}**)`);
    }

    // Match score indicator
    let baseExplanation = '';
    if (matchScore >= 0.8) {
      baseExplanation = '**Rất phù hợp** với bài đăng gia sư của bạn';
    } else if (matchScore >= 0.6) {
      baseExplanation = '**Khá phù hợp** với bài đăng gia sư của bạn';
    } else if (matchScore >= 0.4) {
      baseExplanation = 'Có một số điểm phù hợp';
    } else {
      baseExplanation = 'Có thể phù hợp với một số điều kiện';
    }

    // Build explanation
    if (reasons.length > 0) {
      return `${baseExplanation}. ${reasons.join('. ')}.`;
    }

    return baseExplanation;
  }

  /**
   * Generate explanation for a specific tutor-post match (ON-DEMAND)
   * This is the recommended way to get explanations - only when user clicks
   * 
   * @param studentPostId - Student post ID
   * @param tutorId - Tutor user ID
   * @returns AI-generated explanation
   */
  async generateSingleExplanation(
    studentPostId: string,
    tutorId: string
  ): Promise<string> {
    try {
      logger.info(`🔍 Generating on-demand explanation for tutor ${tutorId} and post ${studentPostId}`);

      // Get student post (subjects is array of strings, not references)
      const studentPost = await Post.findById(studentPostId).lean();

      if (!studentPost) {
        logger.error(`❌ Student post not found: ${studentPostId}`);
        throw new Error('Student post not found');
      }
      
      logger.info(`✅ Found student post: ${studentPost.title}`);

      // Get tutor profile (subjects is array of ObjectIds)
      const tutorProfile = await TutorProfile.findOne({ user_id: tutorId }).lean();

      if (!tutorProfile) {
        throw new Error('Tutor profile not found');
      }

      // Get tutor user info
      const tutorUser = await User.findById(tutorId)
        .select('full_name')
        .lean();

      // Get tutor's active posts (subjects is array of ObjectIds that need population)
      const { Subject } = await import('../../models/Subject');
      const tutorPosts = await TutorPost.find({
        tutorId: tutorId,
        status: 'ACTIVE'
      })
        .limit(1)
        .lean();

      // Manually populate subjects for tutor post if exists
      let tutorPostSubjects: any[] = [];
      if (tutorPosts.length > 0 && tutorPosts[0].subjects) {
        const subjectIds = tutorPosts[0].subjects;
        const subjectDocs = await Subject.find({ _id: { $in: subjectIds } }).select('name').lean();
        tutorPostSubjects = subjectDocs;
      }

      const tutorPost = tutorPosts[0];

      // Calculate match score for context
      let matchScore = 0.5; // Default
      if (tutorPost) {
        matchScore = this.calculateStructuredMatch(studentPost, tutorPost);
      }

      // Try AI explanation first, fallback to rule-based if quota exceeded
      let explanation: string;
      
      try {
        explanation = await geminiService.generateMatchExplanation(
          studentPost,
          {
            full_name: tutorUser?.full_name || 'Gia sư',
            subjects: tutorPostSubjects,
            teaching_experience: tutorProfile.teaching_experience,
            introduction: tutorProfile.introduction
          },
          matchScore
        );
        logger.info(`✅ On-demand explanation generated (AI, ~25 VNĐ)`);
      } catch (aiError: any) {
        // AI failed (quota/429/etc) - fallback to rule-based
        logger.warn('⚠️ AI explanation failed, using rule-based fallback:', aiError.message);
        explanation = this.generateDetailedTutorExplanation(
          studentPost,
          {
            full_name: tutorUser?.full_name || 'Gia sư',
            subjects: tutorPostSubjects,
            teaching_experience: tutorProfile.teaching_experience,
            introduction: tutorProfile.introduction,
            grade_levels: tutorPost?.studentLevel || []
          },
          matchScore
        );
        logger.info(`✅ On-demand explanation generated (rule-based fallback, free)`);
      }

      return explanation;

    } catch (error: any) {
      logger.error('❌ Failed to generate on-demand explanation:', error);
      return 'Gia sư có kinh nghiệm phù hợp với yêu cầu của bạn.';
    }
  }
}

export const smartRecommendationService = new SmartRecommendationService();
