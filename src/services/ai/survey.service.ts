import { StudentSurvey } from '../../models/StudentSurvey';
import { Subject } from '../../models/Subject';
import { TutorPost } from '../../models/TutorPost';
import { TutorProfile } from '../../models/TutorProfile';
import { geminiService } from '../ai/gemini.service';
import { logger } from '../../utils/logger';

/**
 * Grade Level Mapping
 */
const GRADE_LEVEL_MAPPING: Record<string, string[]> = {
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
 * AI Survey Service
 */
class AISurveyService {
  /**
   * Submit survey và nhận AI recommendations
   */
  async submitSurvey(studentId: string, surveyData: any) {
    try {
      logger.info(`📋 Processing survey for student: ${studentId}`);

      // 1. Validate và convert subject names → IDs
      const subjectIds = await this.validateAndConvertSubjects(surveyData.subjects);

      // 2. Deactivate old surveys
      await StudentSurvey.updateMany(
        { studentId, isActive: true },
        { $set: { isActive: false } }
      );

      // 3. Create new survey
      const survey = await StudentSurvey.create({
        studentId,
        gradeLevel: surveyData.gradeLevel,
        subjects: subjectIds,
        goals: surveyData.goals,
        teachingMode: surveyData.teachingMode,
        preferredTeachingStyle: surveyData.preferredTeachingStyle,
        availableTime: surveyData.availableTime,
        budgetRange: surveyData.budgetRange,
        learningPace: surveyData.learningPace,
        priorities: surveyData.priorities,
      });

      logger.info(`✅ Survey created: ${survey._id}`);

      // 4. Generate AI analysis
      const aiAnalysis = await this.generateAIAnalysis(survey);
      survey.aiAnalysis = aiAnalysis;
      await survey.save();

      // 5. Find matching tutors
      const recommendations = await this.findMatchingTutors(survey);

      logger.info(`✅ Found ${recommendations.length} matching tutors`);

      return {
        survey: survey.toJSON(),
        recommendations,
        aiAnalysis,
      };

    } catch (error: any) {
      logger.error('❌ Survey submission error:', error);
      throw new Error(`Failed to process survey: ${error.message}`);
    }
  }

  /**
   * Validate subjects và convert names → IDs
   */
  private async validateAndConvertSubjects(subjectNames: string[]): Promise<string[]> {
    const subjects = await Subject.find({
      name: { $in: subjectNames }
    });

    if (subjects.length === 0) {
      throw new Error('Invalid subjects provided');
    }

    return subjects.map(s => s._id);
  }

  /**
   * Generate AI analysis bằng Gemini
   */
  private async generateAIAnalysis(survey: any) {
    try {
      // Build profile text
      const profileText = this.buildProfileText(survey);

      // Generate learning profile summary
      const learningProfile = await this.generateLearningProfile(profileText);

      // Generate study plan suggestion
      const studyPlan = await this.generateStudyPlan(survey);

      // Recommended tutor types
      const tutorTypes = this.analyzeTutorTypes(survey);

      return {
        learningProfile,
        recommendedTutorTypes: tutorTypes,
        studyPlanSuggestion: studyPlan,
      };

    } catch (error) {
      logger.error('❌ AI analysis error:', error);
      return {
        learningProfile: 'Đang phân tích...',
        recommendedTutorTypes: [],
        studyPlanSuggestion: '',
      };
    }
  }

  /**
   * Build profile text cho Gemini
   */
  private buildProfileText(survey: any): string {
    const parts: string[] = [];

    parts.push(`Học sinh lớp ${survey.gradeLevel}`);
    
    if (survey.goals?.length > 0) {
      const goalTexts = survey.goals.map(this.translateGoal).join(', ');
      parts.push(`Mục tiêu: ${goalTexts}`);
    }

    if (survey.preferredTeachingStyle?.length > 0) {
      const styleTexts = survey.preferredTeachingStyle.map(this.translateTeachingStyle).join(', ');
      parts.push(`Phong cách học ưa thích: ${styleTexts}`);
    }

    parts.push(`Tốc độ học: ${this.translateLearningPace(survey.learningPace)}`);
    parts.push(`Hình thức: ${survey.teachingMode === 'ONLINE' ? 'Trực tuyến' : survey.teachingMode === 'OFFLINE' ? 'Tại nhà' : 'Linh hoạt'}`);

    return parts.join('. ');
  }

  /**
   * Generate learning profile bằng Gemini
   */
  private async generateLearningProfile(profileText: string): Promise<string> {
    if (!geminiService.isAvailable()) {
      return 'AI đang được nâng cấp';
    }

    try {
      const prompt = `
Bạn là chuyên gia tâm lý giáo dục. Dựa vào thông tin sau về học sinh:

${profileText}

Hãy viết 1 đoạn ngắn (50-80 từ) phân tích phong cách học tập của học sinh này, 
điểm mạnh, điểm cần cải thiện, và kiểu gia sư phù hợp.

Viết bằng tiếng Việt, giọng điệu thân thiện và chuyên nghiệp.
`;

      // Use geminiService's getEmbedding method instead of direct genAI access
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      return response.text() || 'Đang phân tích...';

    } catch (error) {
      logger.error('Gemini profile generation error:', error);
      return 'Học sinh có động lực học tập tốt và đang tìm kiếm gia sư phù hợp.';
    }
  }

  /**
   * Generate study plan bằng Gemini
   */
  private async generateStudyPlan(survey: any): Promise<string> {
    if (!geminiService.isAvailable()) {
      return '';
    }

    try {
      const subjects = await Subject.find({ _id: { $in: survey.subjects } });
      const subjectNames = subjects.map(s => s.name).join(', ');

      const prompt = `
Học sinh lớp ${survey.gradeLevel} cần học các môn: ${subjectNames}.
Mục tiêu: ${survey.goals.map(this.translateGoal).join(', ')}.

Hãy đề xuất một lộ trình học ngắn gọn (3-4 bullet points) trong 3 tháng.
Viết bằng tiếng Việt, cụ thể và dễ hiểu.
`;

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      return response.text() || '';

    } catch (error) {
      logger.error('Gemini study plan error:', error);
      return '';
    }
  }

  /**
   * Analyze recommended tutor types
   */
  private analyzeTutorTypes(survey: any): string[] {
    const types: string[] = [];

    // Based on teaching style
    if (survey.preferredTeachingStyle?.includes('traditional')) {
      types.push('Gia sư kinh nghiệm lâu năm');
    }
    if (survey.preferredTeachingStyle?.includes('interactive')) {
      types.push('Gia sư trẻ, năng động');
    }
    if (survey.preferredTeachingStyle?.includes('creative')) {
      types.push('Gia sư sáng tạo, tư duy phản biện');
    }

    // Based on learning pace
    if (survey.learningPace === 'fast_learner') {
      types.push('Gia sư có thể dạy nâng cao');
    }
    if (survey.learningPace === 'need_guidance') {
      types.push('Gia sư kiên nhẫn, tận tâm');
    }

    // Based on priorities
    if (survey.priorities?.qualification >= 4) {
      types.push('Gia sư có bằng cấp cao');
    }
    if (survey.priorities?.experience >= 4) {
      types.push('Gia sư dạy từ 3+ năm');
    }

    return types.slice(0, 3); // Top 3
  }

  /**
   * Find matching tutors based on survey
   */
  private async findMatchingTutors(survey: any) {
    try {
      // 1. Build filters
      const studentLevels = GRADE_LEVEL_MAPPING[survey.gradeLevel] || [];
      
      const filters: any = {
        status: 'ACTIVE',
        subjects: { $in: survey.subjects },
        studentLevel: { $in: studentLevels },
        pricePerSession: {
          $gte: survey.budgetRange.min,
          $lte: survey.budgetRange.max,
        },
      };

      if (survey.teachingMode === 'ONLINE') {
        filters.teachingMode = { $in: ['ONLINE', 'BOTH'] };
      } else if (survey.teachingMode === 'OFFLINE') {
        filters.teachingMode = { $in: ['OFFLINE', 'BOTH'] };
      }

      // 2. Find candidate tutors
      const tutorPosts = await TutorPost.find(filters)
        .populate('tutorId', 'full_name email avatar_url')
        .populate('subjects', 'name category')
        .limit(50)
        .lean();

      if (tutorPosts.length === 0) {
        return [];
      }

      // 3. Get tutor profiles
      const tutorIds = tutorPosts
        .map(tp => tp.tutorId)
        .filter((tutor): tutor is NonNullable<typeof tutor> => tutor !== null)
        .map(tutor => typeof tutor === 'object' && '_id' in tutor ? (tutor as any)._id : tutor);
      
      const tutorProfiles = await TutorProfile.find({
        user_id: { $in: tutorIds }
      }).lean();

      const profileMap = new Map(
        tutorProfiles.map(tp => [tp.user_id, tp])
      );

      // 4. Calculate match scores
      const recommendations = [];

      for (const tutorPost of tutorPosts) {
        // Skip if tutorId is null
        if (!tutorPost.tutorId) continue;
        
        const tutorIdStr = typeof tutorPost.tutorId === 'object' && '_id' in tutorPost.tutorId 
          ? (tutorPost.tutorId as any)._id.toString() 
          : tutorPost.tutorId.toString();
        
        const profile = profileMap.get(tutorIdStr);
        if (!profile) continue;

        // Calculate structured score
        const score = this.calculateSurveyMatchScore(survey, tutorPost, profile);

        // Generate explanation if high score
        let explanation = '';
        if (score >= 0.7 && geminiService.isAvailable()) {
          explanation = await this.generateMatchExplanation(survey, tutorPost, profile, score);
        }

        // Get tutor ID for response
        const responseTutorId = typeof tutorPost.tutorId === 'object' && '_id' in tutorPost.tutorId
          ? (tutorPost.tutorId as any)._id
          : tutorPost.tutorId;

        recommendations.push({
          tutorId: responseTutorId,
          tutorPost,
          tutorProfile: profile,
          matchScore: Math.round(score * 100),
          explanation,
          matchDetails: {
            subjectMatch: this.checkSubjectMatch(survey, tutorPost),
            levelMatch: true,
            priceMatch: this.checkPriceMatch(survey, tutorPost),
            styleMatch: this.checkStyleMatch(survey, profile),
            personalityMatch: this.checkPersonalityMatch(survey, profile),
          },
        });
      }

      // 5. Sort by score and return top 10
      return recommendations
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);

    } catch (error) {
      logger.error('❌ Find matching tutors error:', error);
      return [];
    }
  }

  /**
   * Calculate survey-based match score
   */
  private calculateSurveyMatchScore(survey: any, tutorPost: any, profile: any): number {
    let score = 0;
    let weights = 0;

    // Subject match (30%)
    const subjectMatch = this.checkSubjectMatch(survey, tutorPost) ? 1 : 0;
    score += subjectMatch * 0.3;
    weights += 0.3;

    // Price match (20%)
    const priceMatch = this.checkPriceMatch(survey, tutorPost) ? 1 : 0;
    score += priceMatch * 0.2;
    weights += 0.2;

    // Teaching style match (20%)
    const styleScore = this.checkStyleMatch(survey, profile);
    score += styleScore * 0.2;
    weights += 0.2;

    // Priority-based scoring (30%)
    const priorityScore = this.calculatePriorityScore(survey, tutorPost, profile);
    score += priorityScore * 0.3;
    weights += 0.3;

    return weights > 0 ? score / weights : 0;
  }

  /**
   * Calculate priority-based score
   */
  private calculatePriorityScore(survey: any, tutorPost: any, profile: any): number {
    const priorities = survey.priorities || {};
    let totalWeight = 0;
    let weightedScore = 0;

    // Experience priority
    if (priorities.experience) {
      const weight = priorities.experience / 5;
      totalWeight += weight;
      
      const yearsExp = this.extractYearsOfExperience(profile.teaching_experience);
      const expScore = Math.min(yearsExp / 5, 1); // Max at 5 years
      weightedScore += expScore * weight;
    }

    // Price priority (lower = better if high priority)
    if (priorities.price) {
      const weight = priorities.price / 5;
      totalWeight += weight;
      
      const priceRatio = tutorPost.pricePerSession / survey.budgetRange.max;
      const priceScore = 1 - Math.min(priceRatio, 1);
      weightedScore += priceScore * weight;
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 0.5;
  }

  /**
   * Check subject match
   */
  private checkSubjectMatch(survey: any, tutorPost: any): boolean {
    const surveySubjects = new Set(survey.subjects.map((s: any) => s.toString()));
    const tutorSubjects = new Set(tutorPost.subjects.map((s: any) => 
      typeof s === 'object' ? s._id.toString() : s.toString()
    ));

    return [...surveySubjects].some(s => tutorSubjects.has(s));
  }

  /**
   * Check price match
   */
  private checkPriceMatch(survey: any, tutorPost: any): boolean {
    return tutorPost.pricePerSession >= survey.budgetRange.min &&
           tutorPost.pricePerSession <= survey.budgetRange.max;
  }

  /**
   * Check teaching style match
   */
  private checkStyleMatch(survey: any, profile: any): number {
    // Simplified - can be enhanced with NLP
    if (!survey.preferredTeachingStyle || !profile.teaching_experience) {
      return 0.5;
    }

    const profileText = profile.teaching_experience.toLowerCase();
    let matchCount = 0;

    if (survey.preferredTeachingStyle.includes('interactive') && 
        (profileText.includes('tương tác') || profileText.includes('interactive'))) {
      matchCount++;
    }

    if (survey.preferredTeachingStyle.includes('practice') && 
        (profileText.includes('thực hành') || profileText.includes('practice'))) {
      matchCount++;
    }

    return Math.min(matchCount / survey.preferredTeachingStyle.length, 1);
  }

  /**
   * Check personality match
   */
  private checkPersonalityMatch(survey: any, profile: any): number {
    // Simplified personality matching
    if (survey.learningPace === 'need_guidance') {
      // Prefer patient, experienced tutors
      return profile.teaching_experience?.length > 100 ? 0.8 : 0.5;
    }

    if (survey.learningPace === 'fast_learner') {
      // Prefer tutors with advanced teaching
      return profile.teaching_experience?.includes('nâng cao') ? 0.8 : 0.5;
    }

    return 0.6;
  }

  /**
   * Extract years of experience from text
   */
  private extractYearsOfExperience(text?: string): number {
    if (!text) return 0;

    const match = text.match(/(\d+)\s*(năm|year)/i);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Generate match explanation bằng Gemini
   */
  private async generateMatchExplanation(
    survey: any,
    tutorPost: any,
    profile: any,
    score: number
  ): Promise<string> {
    try {
      const subjects = await Subject.find({ _id: { $in: survey.subjects } });
      const subjectNames = subjects.map(s => s.name).join(', ');

      // Safe access to tutorId name
      const tutorName = tutorPost.tutorId && typeof tutorPost.tutorId === 'object' && 'full_name' in tutorPost.tutorId
        ? tutorPost.tutorId.full_name
        : 'Gia sư';

      const prompt = `
Học sinh lớp ${survey.gradeLevel} đang tìm gia sư dạy ${subjectNames}.
Phong cách học ưa thích: ${survey.preferredTeachingStyle?.join(', ')}.
Tốc độ học: ${this.translateLearningPace(survey.learningPace)}.

Gia sư: ${tutorName}
Kinh nghiệm: ${profile.teaching_experience || 'Chưa cung cấp'}
Giá: ${tutorPost.pricePerSession.toLocaleString('vi-VN')} VNĐ/buổi

Điểm phù hợp: ${Math.round(score * 100)}%

Viết 2-3 câu giải thích ngắn gọn tại sao gia sư này phù hợp với học sinh.
Viết bằng tiếng Việt, thân thiện và chuyên nghiệp.
`;

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      return response.text() || 'Gia sư này phù hợp với yêu cầu của bạn.';

    } catch (error) {
      return 'Gia sư này có kinh nghiệm tốt và phù hợp với yêu cầu của bạn.';
    }
  }

  /**
   * Get student survey
   */
  async getStudentSurvey(studentId: string) {
    const survey = await StudentSurvey.findOne({
      studentId,
      isActive: true
    }).lean();

    return survey;
  }

  /**
   * Translation helpers
   */
  private translateGoal(goal: string): string {
    const translations: Record<string, string> = {
      'improve_grades': 'Cải thiện điểm số',
      'exam_prep': 'Ôn thi đại học',
      'advanced_learning': 'Học thêm nâng cao',
      'foundation': 'Bù kiến thức cơ bản',
      'certification': 'Thi chứng chỉ',
    };
    return translations[goal] || goal;
  }

  private translateTeachingStyle(style: string): string {
    const translations: Record<string, string> = {
      'traditional': 'Truyền thống',
      'interactive': 'Tương tác',
      'practice': 'Thực hành',
      'creative': 'Sáng tạo',
    };
    return translations[style] || style;
  }

  private translateLearningPace(pace: string): string {
    const translations: Record<string, string> = {
      'self_learner': 'Tự học tốt',
      'need_guidance': 'Cần hướng dẫn kỹ',
      'fast_learner': 'Tiếp thu nhanh',
      'steady_learner': 'Học chậm nhưng chắc',
    };
    return translations[pace] || pace;
  }
}

export const aiSurveyService = new AISurveyService();
