import { Request, Response } from 'express';
import { speechToTextService } from '../../services/ai/speechToText.service';
import { logger } from '../../utils/logger';

export class SpeechAIController {
  static async transcribeAudio(req: Request, res: Response) {
    try {
      if (!speechToTextService.isAvailable()) {
        return res.status(503).json({
          success: false,
          message: 'Dịch vụ chuyển giọng nói thành văn bản đang tạm thời không khả dụng',
        });
      }

      const { audioUrl } = req.body as { audioUrl: string };
      const transcript = await speechToTextService.transcribeFromUrl(audioUrl);

      return res.json({
        success: true,
        data: { transcript },
      });
    } catch (error: any) {
      logger.error('Transcribe audio error:', error);

      if (error?.message === 'UNSUPPORTED_AUDIO_FORMAT') {
        return res.status(400).json({
          success: false,
          message:
            'Định dạng audio không được hỗ trợ. Vui lòng dùng các định dạng: mp3, m4a, wav, ogg, webm...',
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Không thể chuyển audio thành văn bản',
      });
    }
  }
}


