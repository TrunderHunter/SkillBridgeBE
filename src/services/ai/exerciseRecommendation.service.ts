import { StudentSurvey } from '../../models/StudentSurvey';
import { ExerciseTemplate } from '../../models/ExerciseTemplate';
import { logger } from '../../utils/logger';

/**
 * Recommend exercise templates dựa trên survey của học viên
 * Ưu tiên lọc cứng theo môn, cấp độ, sau đó dùng AI (Gemini) để xếp hạng nếu cần.
 */
class ExerciseRecommendationService {
  async recommendExercisesForStudent(studentId: string) {
    try {
      const survey = await StudentSurvey.findOne({
        studentId,
        isActive: true,
      }).lean();

      if (!survey) {
        throw new Error('Chưa có khảo sát học tập cho học viên này');
      }

      // Hard filters từ survey: subjects + gradeLevel
      const gradeLevels = this.mapGradeLevelToEnum(survey.gradeLevel);

      const templates = await ExerciseTemplate.find({
        subjectId: { $in: survey.subjects },
        gradeLevels: { $in: gradeLevels },
        $or: [
          { isPublic: true },
          { ownerId: studentId }, // optionally allow student-specific templates
        ],
      })
        .sort({ usageCount: -1, createdAt: -1 })
        .limit(30)
        .lean();

      return {
        survey,
        templates,
      };
    } catch (error: any) {
      logger.error('Exercise recommendation error:', error);
      throw new Error(error.message || 'Không thể gợi ý bài tập');
    }
  }

  private mapGradeLevelToEnum(gradeLevel: string): string[] {
    switch (gradeLevel) {
      case 'Lớp 6':
      case 'Lớp 7':
      case 'Lớp 8':
      case 'Lớp 9':
        return ['TRUNG_HOC_CO_SO'];
      case 'Lớp 10':
      case 'Lớp 11':
      case 'Lớp 12':
        return ['TRUNG_HOC_PHO_THONG'];
      case 'Đại học':
        return ['DAI_HOC'];
      case 'Người đi làm':
        return ['NGUOI_DI_LAM'];
      default:
        return [];
    }
  }
}

export const exerciseRecommendationService = new ExerciseRecommendationService();


