import fetch from 'node-fetch';
import axios from 'axios';
import FormData from 'form-data';
import { logger } from '../../utils/logger';

/**
 * Speech-to-Text Service
 * Supports: OpenAI Whisper API, Google Cloud STT, custom providers
 */
class SpeechToTextService {
  private provider: 'openai' | 'google' | 'custom';
  private apiKey?: string;
  private language?: string;

  constructor() {
    this.apiKey = process.env.STT_API_KEY || process.env.OPENAI_API_KEY;
    this.language = process.env.STT_LANGUAGE || undefined;

    // Auto-detect provider based on env
    if (process.env.STT_PROVIDER === 'google') {
      this.provider = 'google';
    } else if (process.env.STT_PROVIDER === 'custom' && process.env.STT_API_URL) {
      this.provider = 'custom';
    } else {
      this.provider = 'openai'; // Default to OpenAI Whisper
    }

    if (!this.apiKey) {
      logger.warn('⚠️ STT_API_KEY/OPENAI_API_KEY not configured. Speech-to-Text is disabled.');
    } else {
      logger.info(`✅ Speech-to-Text initialized with provider: ${this.provider}`);
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Transcribe an audio file URL to text
   */
  async transcribeFromUrl(audioUrl: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Speech-to-Text service is not configured');
    }

    try {
      // Download audio file from URL first
      logger.info('Downloading audio from:', audioUrl);
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error('Cannot download audio file');
      }

      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';

      // Determine file extension
      let extension = 'mp3';
      if (contentType.includes('wav')) extension = 'wav';
      else if (contentType.includes('webm')) extension = 'webm';
      else if (contentType.includes('m4a')) extension = 'm4a';
      else if (contentType.includes('ogg')) extension = 'ogg';

      if (this.provider === 'openai') {
        return await this.transcribeWithOpenAI(audioBuffer, extension);
      } else if (this.provider === 'google') {
        return await this.transcribeWithGoogle(audioBuffer);
      } else {
        return await this.transcribeWithCustom(audioUrl);
      }
    } catch (error: any) {
      logger.error('Speech-to-Text error:', error);
      throw new Error(error.message || 'Không thể nhận dạng giọng nói');
    }
  }

  /**
   * Transcribe using OpenAI Whisper API
   */
  private async transcribeWithOpenAI(audioBuffer: Buffer, extension: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: `audio.${extension}`,
      contentType: `audio/${extension}`,
    });
    formData.append('model', 'whisper-1');
    // Không ép ngôn ngữ về tiếng Việt nữa.
    // Nếu muốn cố định (vd: luôn tiếng Anh) có thể set STT_LANGUAGE=en trong .env
    if (this.language) {
      formData.append('language', this.language);
    }

    try {
      logger.info('🔁 Calling OpenAI Whisper for transcription...');

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...formData.getHeaders(),
          },
          timeout: 30000,
        }
      );

      const transcript = (response.data as any)?.text;
      if (!transcript) {
        throw new Error('Whisper returned empty transcript');
      }

      logger.info('✅ Whisper transcription success');
      return transcript;
    } catch (error: any) {
      const detail = error?.response?.data || error?.message || error;
      logger.error('❌ OpenAI Whisper error:', detail);

      const rawMessage =
        detail?.error?.message ||
        detail?.message ||
        'OpenAI Whisper transcription failed';

      // Nếu OpenAI báo sai định dạng file thì đánh dấu lỗi đặc biệt
      if (typeof rawMessage === 'string' && rawMessage.includes('Invalid file format')) {
        throw new Error('UNSUPPORTED_AUDIO_FORMAT');
      }

      // Các lỗi khác giữ nguyên message chi tiết
      throw new Error(rawMessage);
    }
  }

  /**
   * Transcribe using Google Cloud Speech-to-Text
   */
  private async transcribeWithGoogle(audioBuffer: Buffer): Promise<string> {
    const audioContent = audioBuffer.toString('base64');

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            encoding: 'MP3',
            sampleRateHertz: 16000,
            languageCode: 'vi-VN',
          },
          audio: { content: audioContent },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Google STT error:', errorText);
      throw new Error('Google Speech-to-Text failed');
    }

    const result = await response.json() as any;
    const transcript = result.results
      ?.map((r: any) => r.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join(' ');

    return transcript || '';
  }

  /**
   * Transcribe using custom provider (expects audioUrl in body)
   */
  private async transcribeWithCustom(audioUrl: string): Promise<string> {
    const providerUrl = process.env.STT_API_URL!;

    const response = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ audioUrl }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Custom STT error:', errorText);
      throw new Error('Custom STT provider failed');
    }

    const data = await response.json() as any;
    return data.transcript || data.text || data.result || '';
  }
}

export const speechToTextService = new SpeechToTextService();


