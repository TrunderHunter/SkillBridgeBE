import { Request, Response } from 'express';
import { aiSurveyService } from '../../services/ai/survey.service';
import { logger } from '../../utils/logger';
import { exerciseRecommendationService } from '../../services/ai/exerciseRecommendation.service';

/**
 * AI Survey Controller
 */
class AISurveyController {
  /**
   * Submit survey và nhận recommendations
   * POST /api/v1/ai/survey
   */
  async submitSurvey(req: Request, res: Response) {
    try {
      const studentId = req.user!.id;
      const surveyData = req.body;

      logger.info(`📋 Survey submission from student: ${studentId}`);

      const result = await aiSurveyService.submitSurvey(studentId, surveyData);

      res.status(200).json({
        success: true,
        message: 'Khảo sát đã được xử lý thành công',
        data: result,
      });

    } catch (error: any) {
      logger.error('❌ Submit survey error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi xử lý khảo sát',
      });
    }
  }

  /**
   * Get student's current survey
   * GET /api/v1/ai/survey
   */
  async getSurvey(req: Request, res: Response) {
    try {
      const studentId = req.user!.id;

      const surveyResult = await aiSurveyService.getStudentSurveyResult(studentId);

      if (!surveyResult) {
        return res.status(404).json({
          success: false,
          message: 'Chưa có khảo sát nào',
        });
      }

      res.status(200).json({
        success: true,
        data: surveyResult,
      });

    } catch (error: any) {
      logger.error('❌ Get survey error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy thông tin khảo sát',
      });
    }
  }

  /**
   * Check if student has completed survey
   * GET /api/v1/ai/survey/status
   */
  async getSurveyStatus(req: Request, res: Response) {
    try {
      const studentId = req.user!.id;

      const survey = await aiSurveyService.getActiveSurvey(studentId);

      res.status(200).json({
        success: true,
        data: {
          hasCompletedSurvey: !!survey,
          completedAt: survey?.completedAt,
          canRetake: true, // Always allow retaking
        },
      });

    } catch (error: any) {
      logger.error('❌ Get survey status error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi kiểm tra trạng thái khảo sát',
      });
    }
  }

  /**
   * Recommend exercise templates based on student's survey
   * GET /api/v1/ai/survey/exercises
   */
  async getExerciseRecommendations(req: Request, res: Response) {
    try {
      const studentId = req.user!.id;
      const result =
        await exerciseRecommendationService.recommendExercisesForStudent(
          studentId
        );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('❌ Get exercise recommendations error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Không thể gợi ý bài tập',
      });
    }
  }
}

export const aiSurveyController = new AISurveyController();
