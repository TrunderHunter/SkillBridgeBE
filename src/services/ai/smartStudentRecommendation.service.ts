import { Post } from '../../models/Post';
import { TutorPost } from '../../models/TutorPost';
import { TutorProfile } from '../../models/TutorProfile';
import { User } from '../../models/User';
import { Subject } from '../../models/Subject';
import { geminiService } from './gemini.service';
import { logger } from './../../utils/logger';

/**
 * Map tutor student level enums to student grade levels
 */
const STUDENT_LEVEL_MAPPING: { [key: string]: string[] } = {
  'TIEU_HOC': ['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5'],
  'TRUNG_HOC_CO_SO': ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9'],
  'TRUNG_HOC_PHO_THONG': ['Lớp 10', 'Lớp 11', 'Lớp 12'],
  'DAI_HOC': ['Đại học'],
  'NGUOI_DI_LAM': ['Người đi làm'],
};

/**
 * Interface for smart student recommendation result
 */
export interface ISmartStudentRecommendation {
  postId: string;
  studentPost: any;
  studentProfile?: any;
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
export interface IStudentRecommendationOptions {
  limit?: number;
  minScore?: number;
  includeExplanations?: boolean;
}

/**
 * Smart Student Recommendation Service
 * Implements hybrid search: filtering + vector semantic search
 * For tutors to find matching student posts
 */
class SmartStudentRecommendationService {
  /**
   * Get smart student post recommendations for a tutor
   * @param tutorId - ID of tutor
   * @param options - Recommendation options
   */
  async getRecommendations(
    tutorId: string,
    options: IStudentRecommendationOptions = {}
  ): Promise<ISmartStudentRecommendation[]> {
    const {
      limit = 10,
      minScore = 0.5,
      includeExplanations = true
    } = options;

    try {
      // Step 1: Get tutor profile and posts
      const tutorProfile = await TutorProfile.findOne({ user_id: tutorId }).lean();
      if (!tutorProfile) {
        throw new Error('Tutor profile not found');
      }

      const tutorPosts = await TutorPost.find({
        tutorId,
        status: 'ACTIVE'
      })
        .populate('subjects', 'name')
        .limit(5) // Latest 5 posts
        .lean();

      if (tutorPosts.length === 0) {
        logger.info(`❌ No active tutor posts found for tutor: ${tutorId}`);
        return [];
      }

      logger.info(`🔍 Finding student recommendations for tutor: ${tutorId}`);

      // Step 2: Build structured filters from tutor profile and posts
      const filters = await this.buildStructuredFilters(tutorProfile, tutorPosts);

      // Step 3: Get matching student posts with filters
      const candidateStudentPosts = await this.getCandidateStudentPosts(filters);

      if (candidateStudentPosts.length === 0) {
        logger.info('❌ No student posts match the hard filters');
        return [];
      }

      logger.info(`✅ Found ${candidateStudentPosts.length} candidate student posts after filtering`);

      // Step 4: Generate query vector for semantic search
      const queryText = this.buildQueryText(tutorProfile, tutorPosts);
      let queryVector: number[] | null = null;

      if (geminiService.isAvailable()) {
        try {
          queryVector = await geminiService.getEmbedding(queryText);
          logger.info('✅ Query vector generated');
        } catch (error) {
          logger.warn('⚠️ Failed to generate query vector, using filter-only mode');
        }
      }

      // Step 5: Calculate match scores
      const recommendations = await this.calculateMatchScores(
        tutorProfile,
        tutorPosts,
        candidateStudentPosts,
        queryVector
      );

      // Step 6: Filter by minimum score and sort
      const filteredRecs = recommendations
        .filter(rec => rec.matchScore >= minScore)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit);

      // Step 7: Generate explanations if needed
      if (includeExplanations && geminiService.isAvailable()) {
        await this.addExplanations(tutorProfile, tutorPosts, filteredRecs);
      }

      logger.info(`✅ Returning ${filteredRecs.length} recommendations`);

      return filteredRecs;

    } catch (error: any) {
      logger.error('❌ Smart student recommendation error:', error);
      throw new Error(`Failed to generate student recommendations: ${error.message}`);
    }
  }

  /**
   * Build structured filters from tutor profile and posts
   */
  private async buildStructuredFilters(tutorProfile: any, tutorPosts: any[]): Promise<any> {
    const filters: any = {
      status: 'approved', // Only approved posts
      type: 'student_request', // Only student request posts
    };

    // Collect all subjects from tutor posts
    const tutorSubjectIds = new Set<string>();
    tutorPosts.forEach(post => {
      if (post.subjects) {
        post.subjects.forEach((subject: any) => {
          const subjectId = typeof subject === 'object' ? subject._id.toString() : subject.toString();
          tutorSubjectIds.add(subjectId);
        });
      }
    });

    if (tutorSubjectIds.size > 0) {
      filters.subjects = { $in: Array.from(tutorSubjectIds) };
      logger.info(`📚 Filtering by subjects: ${Array.from(tutorSubjectIds)}`);
    }

    // Collect all student levels from tutor posts and map to grade levels
    const gradeLevels = new Set<string>();
    tutorPosts.forEach(post => {
      if (post.studentLevel && Array.isArray(post.studentLevel)) {
        post.studentLevel.forEach((level: string) => {
          const mappedGrades = STUDENT_LEVEL_MAPPING[level];
          if (mappedGrades) {
            mappedGrades.forEach(grade => gradeLevels.add(grade));
          }
        });
      }
    });

    if (gradeLevels.size > 0) {
      filters.grade_levels = { $in: Array.from(gradeLevels) };
      logger.info(`📖 Filtering by grade levels: ${Array.from(gradeLevels)}`);
    }

    // Price filter - get price range from tutor posts
    const tutorPrices = tutorPosts
      .map(p => p.pricePerSession)
      .filter(p => p !== undefined && p !== null);
    
    if (tutorPrices.length > 0) {
      const minPrice = Math.min(...tutorPrices);
      const maxPrice = Math.max(...tutorPrices);
      
      // Student posts should have hourly_rate that overlaps with tutor's price range
      filters.$or = [
        { 'hourly_rate.min': { $lte: maxPrice } },
        { 'hourly_rate.max': { $gte: minPrice } },
        { hourly_rate: { $exists: false } }, // If no price specified, include it
      ];
    }

    // Teaching mode filter
    const teachingModes = new Set<string>();
    tutorPosts.forEach(post => {
      if (post.teachingMode) {
        teachingModes.add(post.teachingMode);
      }
    });

    if (teachingModes.has('ONLINE') && !teachingModes.has('OFFLINE') && !teachingModes.has('BOTH')) {
      filters.is_online = true;
    } else if (teachingModes.has('OFFLINE') && !teachingModes.has('ONLINE') && !teachingModes.has('BOTH')) {
      filters.is_online = false;
    }
    // If BOTH or mixed, don't filter by is_online

    return filters;
  }

  /**
   * Get candidate student posts that match structured filters
   */
  private async getCandidateStudentPosts(filters: any): Promise<any[]> {
    return await Post.find(filters)
      .populate('author_id', 'full_name email phone_number avatar_url')
      .populate('subjects', 'name')
      .limit(100) // Limit to avoid processing too many
      .lean();
  }

  /**
   * Build query text for semantic search from tutor profile and posts
   */
  private buildQueryText(tutorProfile: any, tutorPosts: any[]): string {
    const parts: string[] = [];

    // Add tutor profile info
    if (tutorProfile.headline) {
      parts.push(`Tiêu đề: ${tutorProfile.headline}`);
    }

    if (tutorProfile.introduction) {
      parts.push(`Giới thiệu: ${tutorProfile.introduction}`);
    }

    if (tutorProfile.teaching_experience) {
      parts.push(`Kinh nghiệm: ${tutorProfile.teaching_experience}`);
    }

    // Aggregate from tutor posts
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
      parts.push(`Cấp độ nhận dạy: ${Array.from(levels).join(', ')}`);
    }

    return parts.join('. ');
  }

  /**
   * Calculate match scores for each candidate
   */
  private async calculateMatchScores(
    tutorProfile: any,
    tutorPosts: any[],
    candidateStudentPosts: any[],
    queryVector: number[] | null
  ): Promise<ISmartStudentRecommendation[]> {
    const recommendations: ISmartStudentRecommendation[] = [];

    for (const studentPost of candidateStudentPosts) {
      try {
        // Calculate structured match
        const structuredScore = this.calculateStructuredMatch(tutorPosts, studentPost);

        // Calculate semantic match if vector available
        let semanticScore = 0;
        if (queryVector && studentPost.postVector && studentPost.postVector.length > 0) {
          semanticScore = geminiService.cosineSimilarity(
            queryVector,
            studentPost.postVector
          );
        }

        // Combined score (70% structured, 30% semantic)
        const matchScore = (structuredScore * 0.7) + (semanticScore * 0.3);

        // Build match details
        const matchDetails = this.buildMatchDetails(
          tutorPosts,
          studentPost,
          semanticScore
        );

        recommendations.push({
          postId: studentPost._id.toString(),
          studentPost,
          matchScore,
          explanation: '', // Will be filled later if needed
          matchDetails
        });

      } catch (error) {
        logger.error(`Error processing student post ${studentPost._id}:`, error);
      }
    }

    return recommendations;
  }

  /**
   * Calculate structured match score (0-1)
   */
  private calculateStructuredMatch(tutorPosts: any[], studentPost: any): number {
    let score = 0;
    let factors = 0;

    // Subject match (weight: 0.3)
    if (studentPost.subjects && tutorPosts.length > 0) {
      const studentSubjects = new Set<string>(
        studentPost.subjects.map((s: any) =>
          typeof s === 'object' ? s._id.toString() : s.toString()
        )
      );

      const tutorSubjects = new Set<string>();
      tutorPosts.forEach(post => {
        if (post.subjects) {
          post.subjects.forEach((subject: any) => {
            const subjectId = typeof subject === 'object' ? subject._id.toString() : subject.toString();
            tutorSubjects.add(subjectId);
          });
        }
      });

      const intersection = [...studentSubjects].filter((s: string) => tutorSubjects.has(s));
      const matchRatio = intersection.length / studentSubjects.size;
      score += matchRatio * 0.3;
      factors += 0.3;
    }

    // Level match (weight: 0.25)
    if (studentPost.grade_levels && tutorPosts.length > 0) {
      const studentGrades = new Set(studentPost.grade_levels);

      let hasMatch = false;
      tutorPosts.forEach(post => {
        if (post.studentLevel) {
          post.studentLevel.forEach((level: string) => {
            const mappedGrades = STUDENT_LEVEL_MAPPING[level];
            if (mappedGrades) {
              mappedGrades.forEach(grade => {
                if (studentGrades.has(grade)) {
                  hasMatch = true;
                }
              });
            }
          });
        }
      });

      score += (hasMatch ? 1 : 0) * 0.25;
      factors += 0.25;
    }

    // Price match (weight: 0.25)
    if (studentPost.hourly_rate && tutorPosts.length > 0) {
      const { min = 0, max = Infinity } = studentPost.hourly_rate;
      
      const tutorPrices = tutorPosts
        .map(p => p.pricePerSession)
        .filter(p => p !== undefined && p !== null);
      
      if (tutorPrices.length > 0) {
        const tutorMinPrice = Math.min(...tutorPrices);
        const tutorMaxPrice = Math.max(...tutorPrices);
        
        // Check if price ranges overlap
        const inRange = tutorMinPrice <= max && tutorMaxPrice >= min;
        score += (inRange ? 1 : 0) * 0.25;
        factors += 0.25;
      }
    }

    // Teaching mode match (weight: 0.2)
    if (studentPost.is_online !== undefined && tutorPosts.length > 0) {
      const studentMode = studentPost.is_online ? 'ONLINE' : 'OFFLINE';
      
      let matches = false;
      tutorPosts.forEach(post => {
        if (post.teachingMode === 'BOTH' || post.teachingMode === studentMode) {
          matches = true;
        }
      });

      score += (matches ? 1 : 0) * 0.2;
      factors += 0.2;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Build detailed match information
   */
  private buildMatchDetails(
    tutorPosts: any[],
    studentPost: any,
    semanticScore: number
  ): any {
    return {
      subjectMatch: this.checkSubjectMatch(tutorPosts, studentPost),
      levelMatch: this.checkLevelMatch(tutorPosts, studentPost),
      priceMatch: this.checkPriceMatch(tutorPosts, studentPost),
      scheduleMatch: true, // Simplified - can be enhanced
      semanticScore
    };
  }

  private checkSubjectMatch(tutorPosts: any[], studentPost: any): boolean {
    if (!studentPost.subjects || tutorPosts.length === 0) return false;

    const studentSubjects = new Set<string>(
      studentPost.subjects.map((s: any) =>
        typeof s === 'object' ? s._id.toString() : s.toString()
      )
    );

    const tutorSubjects = new Set<string>();
    tutorPosts.forEach(post => {
      if (post.subjects) {
        post.subjects.forEach((subject: any) => {
          const subjectId = typeof subject === 'object' ? subject._id.toString() : subject.toString();
          tutorSubjects.add(subjectId);
        });
      }
    });

    return [...studentSubjects].some((s: string) => tutorSubjects.has(s));
  }

  private checkLevelMatch(tutorPosts: any[], studentPost: any): boolean {
    if (!studentPost.grade_levels || tutorPosts.length === 0) return false;

    const studentGrades = new Set(studentPost.grade_levels);

    for (const post of tutorPosts) {
      if (post.studentLevel) {
        for (const level of post.studentLevel) {
          const mappedGrades = STUDENT_LEVEL_MAPPING[level];
          if (mappedGrades) {
            for (const grade of mappedGrades) {
              if (studentGrades.has(grade)) {
                return true;
              }
            }
          }
        }
      }
    }

    return false;
  }

  private checkPriceMatch(tutorPosts: any[], studentPost: any): boolean {
    if (!studentPost.hourly_rate || tutorPosts.length === 0) return true;

    const { min = 0, max = Infinity } = studentPost.hourly_rate;

    const tutorPrices = tutorPosts
      .map(p => p.pricePerSession)
      .filter(p => p !== undefined && p !== null);

    if (tutorPrices.length === 0) return true;

    const tutorMinPrice = Math.min(...tutorPrices);
    const tutorMaxPrice = Math.max(...tutorPrices);

    return tutorMinPrice <= max && tutorMaxPrice >= min;
  }

  /**
   * Add AI-generated explanations to recommendations
   */
  private async addExplanations(
    tutorProfile: any,
    tutorPosts: any[],
    recommendations: ISmartStudentRecommendation[]
  ): Promise<void> {
    for (const rec of recommendations) {
      try {
        // Build tutor summary for explanation
        const tutorSummary = {
          headline: tutorProfile.headline,
          introduction: tutorProfile.introduction?.substring(0, 200),
          teaching_experience: tutorProfile.teaching_experience?.substring(0, 200),
          subjects: tutorPosts[0]?.subjects || [],
        };

        rec.explanation = await geminiService.generateStudentMatchExplanation(
          tutorSummary,
          {
            title: rec.studentPost.title,
            content: rec.studentPost.content?.substring(0, 200),
            subjects: rec.studentPost.subjects,
            grade_levels: rec.studentPost.grade_levels,
            requirements: rec.studentPost.requirements,
          },
          rec.matchScore
        );
      } catch (error) {
        logger.error('Failed to generate explanation:', error);
        rec.explanation = 'Bài đăng này phù hợp với hồ sơ và khả năng dạy của bạn.';
      }
    }
  }
}

export const smartStudentRecommendationService = new SmartStudentRecommendationService();

