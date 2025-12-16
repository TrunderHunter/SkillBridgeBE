import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import LearningClass from '../../models/LearningClass';

/**
 * Jitsi Webhook Controller
 * Handles events from Jitsi JaaS (meeting platform)
 * 
 * Events supported:
 * - participant-joined: When user joins meeting
 * - participant-left: When user leaves meeting
 * - recording-status-changed: When recording starts/stops/ready
 */

interface JitsiWebhookPayload {
  event: 'participant-joined' | 'participant-left' | 'recording-status-changed';
  room: string; // Room name
  timestamp: string;
  participant?: {
    id: string;
    name: string;
    email?: string;
    role?: string; // 'moderator' or 'participant'
  };
  recording?: {
    id: string;
    status: 'started' | 'stopped' | 'available' | 'failed';
    download_url?: string;
    duration?: number;
    size?: number;
  };
}

class JitsiWebhookController {
  /**
   * Handle all Jitsi webhook events
   */
  static async handleWebhook(req: Request, res: Response) {
    try {
      const payload: JitsiWebhookPayload = req.body;

      logger.info('Received Jitsi webhook:', {
        event: payload.event,
        room: payload.room,
        timestamp: payload.timestamp,
      });

      // Verify webhook authenticity (optional but recommended)
      const webhookSecret = process.env.JITSI_WEBHOOK_SECRET;
      if (webhookSecret) {
        const signature = req.headers['x-jitsi-signature'] as string;
        if (!signature || !JitsiWebhookController.verifySignature(signature, req.body, webhookSecret)) {
          logger.warn('Invalid Jitsi webhook signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Route to specific handler based on event type
      switch (payload.event) {
        case 'participant-joined':
          await JitsiWebhookController.handleParticipantJoined(payload);
          break;
        case 'participant-left':
          await JitsiWebhookController.handleParticipantLeft(payload);
          break;
        case 'recording-status-changed':
          await JitsiWebhookController.handleRecordingStatusChanged(payload);
          break;
        default:
          logger.warn(`Unknown Jitsi event: ${payload.event}`);
      }

      // Always return 200 to acknowledge receipt
      res.status(200).json({ success: true, message: 'Webhook received' });
    } catch (error: any) {
      logger.error('Jitsi webhook error:', error);
      // Still return 200 to prevent Jitsi from retrying
      res.status(200).json({ success: false, error: error.message });
    }
  }

  /**
   * Handle participant joined event
   */
  private static async handleParticipantJoined(payload: JitsiWebhookPayload) {
    try {
      const { room, participant } = payload;

      if (!participant) return;

      // Extract class info from room name
      // Room format: "skillbridge-classId-sessionNumber" or similar
      const { classId, sessionNumber } = JitsiWebhookController.parseRoomName(room);

      if (!classId || !sessionNumber) {
        logger.warn(`Cannot parse room name: ${room}`);
        return;
      }

      // Find learning class and session
      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) {
        logger.warn(`Learning class not found: ${classId}`);
        return;
      }

      const session = learningClass.sessions.find(
        (s) => s.sessionNumber === sessionNumber
      );

      if (!session) {
        logger.warn(`Session ${sessionNumber} not found in class ${classId}`);
        return;
      }

      // Initialize participation if not exists
      if (!session.participation) {
        (session as any).participation = {
          tutorDuration: 0,
          tutorJoinCount: 0,
          studentDuration: 0,
          studentJoinCount: 0,
          bothParticipated: false,
        };
      }

      const now = new Date();

      // Determine if participant is tutor or student based on role/email
      const isTutor = participant.role === 'moderator' || 
                      participant.name?.toLowerCase().includes('tutor') ||
                      participant.name?.toLowerCase().includes('gia sư');

      if (isTutor) {
        if (!session.participation.tutorJoinedAt) {
          session.participation.tutorJoinedAt = now;
        }
        session.participation.tutorJoinCount = 
          (session.participation.tutorJoinCount || 0) + 1;
        
        logger.info(`Tutor joined session ${sessionNumber} of class ${classId}`);
      } else {
        if (!session.participation.studentJoinedAt) {
          session.participation.studentJoinedAt = now;
        }
        session.participation.studentJoinCount = 
          (session.participation.studentJoinCount || 0) + 1;
        
        logger.info(`Student joined session ${sessionNumber} of class ${classId}`);
      }

      // Update session start time if first join
      if (!session.actualStartTime) {
        session.actualStartTime = now;
      }

      await learningClass.save();

      logger.info(`Tracked join for ${isTutor ? 'tutor' : 'student'} in session ${sessionNumber}`);
    } catch (error) {
      logger.error('Error handling participant joined:', error);
    }
  }

  /**
   * Handle participant left event
   */
  private static async handleParticipantLeft(payload: JitsiWebhookPayload) {
    try {
      const { room, participant } = payload;

      if (!participant) return;

      const { classId, sessionNumber } = JitsiWebhookController.parseRoomName(room);

      if (!classId || !sessionNumber) return;

      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) return;

      const session = learningClass.sessions.find(
        (s) => s.sessionNumber === sessionNumber
      );

      if (!session || !session.participation) return;

      const now = new Date();

      const isTutor = participant.role === 'moderator' || 
                      participant.name?.toLowerCase().includes('tutor') ||
                      participant.name?.toLowerCase().includes('gia sư');

      // Calculate duration
      if (isTutor && session.participation.tutorJoinedAt) {
        session.participation.tutorLeftAt = now;
        const duration = Math.floor(
          (now.getTime() - session.participation.tutorJoinedAt.getTime()) / 60000
        );
        session.participation.tutorDuration = 
          (session.participation.tutorDuration || 0) + duration;
        
        logger.info(`Tutor left session ${sessionNumber}, duration: ${duration} minutes`);
      } else if (!isTutor && session.participation.studentJoinedAt) {
        session.participation.studentLeftAt = now;
        const duration = Math.floor(
          (now.getTime() - session.participation.studentJoinedAt.getTime()) / 60000
        );
        session.participation.studentDuration = 
          (session.participation.studentDuration || 0) + duration;
        
        logger.info(`Student left session ${sessionNumber}, duration: ${duration} minutes`);
      }

      // Check if both participated sufficiently (50% of session duration)
      const minDuration = session.duration * 0.5;
      const tutorParticipated = 
        (session.participation.tutorDuration || 0) >= minDuration;
      const studentParticipated = 
        (session.participation.studentDuration || 0) >= minDuration;

      if (tutorParticipated && studentParticipated && session.status === 'SCHEDULED') {
        session.participation.bothParticipated = true;
        session.participation.completedAt = now;
        session.status = 'COMPLETED';
        session.actualEndTime = now;

        // Update completed sessions count
        learningClass.completedSessions = learningClass.sessions.filter(
          (s) => s.status === 'COMPLETED'
        ).length;

        // Auto-complete class if all sessions completed
        if (
          learningClass.completedSessions === learningClass.totalSessions &&
          learningClass.status !== 'COMPLETED'
        ) {
          learningClass.status = 'COMPLETED';
          learningClass.actualEndDate = now;
        }

        logger.info(`Session ${sessionNumber} auto-completed (both participated sufficiently)`);
      }

      await learningClass.save();
    } catch (error) {
      logger.error('Error handling participant left:', error);
    }
  }

  /**
   * Handle recording status changed event
   */
  private static async handleRecordingStatusChanged(payload: JitsiWebhookPayload) {
    try {
      const { room, recording } = payload;

      if (!recording) return;

      const { classId, sessionNumber } = JitsiWebhookController.parseRoomName(room);

      if (!classId || !sessionNumber) return;

      const learningClass = await LearningClass.findById(classId);
      if (!learningClass) return;

      const session = learningClass.sessions.find(
        (s) => s.sessionNumber === sessionNumber
      );

      if (!session) return;

      // Initialize participation if not exists
      if (!session.participation) {
        (session as any).participation = {
          tutorDuration: 0,
          tutorJoinCount: 0,
          studentDuration: 0,
          studentJoinCount: 0,
          bothParticipated: false,
        };
      }

      // Update or create recording metadata
      if (!session.participation.recording) {
        (session as any).participation.recording = {
          enabled: true,
        };
      }

      const now = new Date();

      switch (recording.status) {
        case 'started':
          session.participation.recording!.recordingStartedAt = now;
          session.participation.recording!.status = 'RECORDING';
          logger.info(`Recording started for session ${sessionNumber}`);
          break;

        case 'stopped':
          session.participation.recording!.recordingEndedAt = now;
          session.participation.recording!.status = 'PROCESSING';
          logger.info(`Recording stopped for session ${sessionNumber}`);
          break;

        case 'available':
          session.participation.recording!.recordingId = recording.id;
          session.participation.recording!.recordingUrl = recording.download_url;
          session.participation.recording!.duration = recording.duration;
          session.participation.recording!.fileSize = recording.size;
          session.participation.recording!.status = 'READY';
          logger.info(`Recording ready for session ${sessionNumber}: ${recording.download_url}`);
          break;

        case 'failed':
          session.participation.recording!.status = 'FAILED';
          logger.error(`Recording failed for session ${sessionNumber}`);
          break;
      }

      await learningClass.save();
    } catch (error) {
      logger.error('Error handling recording status:', error);
    }
  }

  /**
   * Parse room name to extract classId and sessionNumber
   * Expected format: "skillbridge-{classId}-{sessionNumber}" or similar
   */
  private static parseRoomName(room: string): { 
    classId: string | null; 
    sessionNumber: number | null;
  } {
    try {
      // Remove any tenant prefix (e.g., "vpaas-magic-cookie-123/")
      const cleanRoom = room.split('/').pop() || room;
      
      // Try to extract from various formats
      // Format 1: skillbridge-{classId}-{sessionNumber}
      const match1 = cleanRoom.match(/skillbridge-([a-f0-9]{24})-(\d+)/i);
      if (match1) {
        return {
          classId: match1[1],
          sessionNumber: parseInt(match1[2], 10),
        };
      }

      // Format 2: Just check if it contains a MongoDB ObjectId pattern
      const match2 = cleanRoom.match(/([a-f0-9]{24})/i);
      const match3 = cleanRoom.match(/\d+$/);
      if (match2 && match3) {
        return {
          classId: match2[1],
          sessionNumber: parseInt(match3[0], 10),
        };
      }

      logger.warn(`Cannot parse room name: ${room}`);
      return { classId: null, sessionNumber: null };
    } catch (error) {
      logger.error('Error parsing room name:', error);
      return { classId: null, sessionNumber: null };
    }
  }

  /**
   * Verify webhook signature (if Jitsi sends one)
   */
  private static verifySignature(
    signature: string,
    payload: any,
    secret: string
  ): boolean {
    try {
      const crypto = require('crypto');
      const hash = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      return hash === signature;
    } catch (error) {
      logger.error('Error verifying signature:', error);
      return false;
    }
  }
}

export default JitsiWebhookController;
