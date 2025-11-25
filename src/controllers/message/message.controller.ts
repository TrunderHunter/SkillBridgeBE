import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { MessageService } from '../../services/message/message.service';
import { uploadToCloudinaryGeneric } from '../../config/cloudinary';
import { sendSuccess, sendError } from '../../utils/response';

export class MessageController {
  // Create conversation (usually called when contact request is accepted)
  static async createConversation(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendError(res, 'Dữ liệu không hợp lệ', errors.array(), 400);
      }

      const { contactRequestId } = req.body;

      const result = await MessageService.createConversation(contactRequestId);

      if (result.success) {
        sendSuccess(res, result.message, result.data, 201);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      console.error('❌ Create conversation controller error:', error);
      sendError(res, error.message || 'Lỗi khi tạo cuộc trò chuyện', undefined, 500);
    }
  }

  // Send message
  static async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendError(res, 'Dữ liệu không hợp lệ', errors.array(), 400);
      }

      const { conversationId } = req.params;
      const { content, messageType, fileMetadata, replyTo } = req.body;
      const senderId = req.user?.id;

      if (!senderId) {
        return sendError(res, 'Không xác định được người gửi', undefined, 401);
      }

      const normalizedType = typeof messageType === 'string' ? messageType.toUpperCase() : undefined;

      const messageData = {
        conversationId,
        senderId,
        content,
        messageType: normalizedType,
        fileMetadata,
        replyTo,
      };

      const result = await MessageService.sendMessage({
        ...messageData,
        messageType: normalizedType as "TEXT" | "IMAGE" | "FILE" | undefined,
      });

      if (result.success) {
        sendSuccess(res, result.message, result.data, 201);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      console.error('❌ Send message controller error:', error);
      sendError(res, error.message || 'Lỗi khi gửi tin nhắn', undefined, 500);
    }
  }

  // Get messages in conversation
  static async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const { page, limit } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Không xác định được người dùng', undefined, 401);
      }

      const options = {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      };

      const result = await MessageService.getMessages(conversationId, userId, options);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, result.message.includes('Không tìm thấy') ? 404 : 400);
      }
    } catch (error: any) {
      console.error('❌ Get messages controller error:', error);
      sendError(res, error.message || 'Lỗi khi lấy tin nhắn', undefined, 500);
    }
  }

  // Get user's conversations
  static async getUserConversations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Không xác định được người dùng', undefined, 401);
      }

      const result = await MessageService.getUserConversations(userId);

      if (result.success) {
        sendSuccess(res, result.message, result.data);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      console.error('❌ Get user conversations controller error:', error);
      sendError(res, error.message || 'Lỗi khi lấy danh sách cuộc trò chuyện', undefined, 500);
    }
  }

  // Mark messages as read
  static async markMessagesAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Không xác định được người dùng', undefined, 401);
      }

      const result = await MessageService.markMessagesAsRead(conversationId, userId);

      if (result.success) {
        sendSuccess(res, result.message);
      } else {
        sendError(res, result.message, undefined, result.message.includes('Không tìm thấy') ? 404 : 400);
      }
    } catch (error: any) {
      console.error('❌ Mark messages as read controller error:', error);
      sendError(res, error.message || 'Lỗi khi đánh dấu tin nhắn đã đọc', undefined, 500);
    }
  }

  // Close conversation
  static async closeConversation(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Không xác định được người dùng', undefined, 401);
      }

      const result = await MessageService.closeConversation(conversationId, userId);

      if (result.success) {
        sendSuccess(res, result.message);
      } else {
        sendError(res, result.message, undefined, result.message.includes('Không tìm thấy') ? 404 : 400);
      }
    } catch (error: any) {
      console.error('❌ Close conversation controller error:', error);
      sendError(res, error.message || 'Lỗi khi đóng cuộc trò chuyện', undefined, 500);
    }
  }

  // Get conversation by contact request ID
  static async getConversationByContactRequest(req: Request, res: Response): Promise<void> {
    try {
      const { contactRequestId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Không xác định được người dùng', undefined, 401);
      }

      // Find conversation by contact request ID
      const { Conversation } = await import('../../models/Conversation');
      const conversation = await Conversation.findOne({ contactRequestId })
        .populate('studentId', 'full_name avatar_url')
        .populate('tutorId', 'full_name avatar_url')
        .populate('tutorPostId', 'title')
        .populate('subject', 'name');

      if (!conversation) {
        return sendError(res, 'Không tìm thấy cuộc trò chuyện', undefined, 404);
      }

      // Check if user has access
      const studentIdStr = typeof conversation.studentId === 'string' 
        ? conversation.studentId 
        : (conversation.studentId as any)._id;
      const tutorIdStr = typeof conversation.tutorId === 'string' 
        ? conversation.tutorId 
        : (conversation.tutorId as any)._id;

      if (studentIdStr !== userId && tutorIdStr !== userId) {
        return sendError(res, 'Bạn không có quyền truy cập cuộc trò chuyện này', undefined, 403);
      }

      sendSuccess(res, 'Lấy cuộc trò chuyện thành công', conversation);
    } catch (error: any) {
      console.error('❌ Get conversation by contact request controller error:', error);
      sendError(res, error.message || 'Lỗi khi lấy cuộc trò chuyện', undefined, 500);
    }
  }

  // Create conversation from class
  static async createConversationFromClass(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendError(res, 'Dữ liệu không hợp lệ', errors.array(), 400);
      }

      const { classId } = req.body;

      const result = await MessageService.createConversationFromClass(classId);

      if (result.success) {
        sendSuccess(res, result.message, result.data, result.data ? 200 : 201);
      } else {
        sendError(res, result.message, undefined, 400);
      }
    } catch (error: any) {
      console.error('❌ Create conversation from class controller error:', error);
      sendError(res, error.message || 'Lỗi khi tạo cuộc trò chuyện từ lớp học', undefined, 500);
    }
  }

  // Upload chat attachment (via Cloudinary)
  static async uploadAttachment(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'Không xác định được người dùng', undefined, 401);
      }

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        return sendError(res, 'Không có tệp để tải lên', undefined, 400);
      }

      // Optional subdir, default to 'attachments'
      const subdir = (req.query.subdir as string) || 'attachments';
      const folder = `conversations/${conversationId}/${subdir}`;

      // Sanitize filename properly
      const originalName = file.originalname || 'file';
      const sanitizedName = originalName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^\w.-]/g, '_');
      
      const safeName = `${Date.now()}-${sanitizedName}`;

      const url = await uploadToCloudinaryGeneric(file.buffer, folder, safeName);

      return sendSuccess(res, 'Upload tệp thành công', {
        url,
        fileName: sanitizedName, // Use sanitized name to avoid encoding issues
        fileType: file.mimetype,
        fileSize: file.size,
      });
    } catch (error: any) {
      console.error('❌ Upload attachment controller error:', error);
      return sendError(res, error.message || 'Lỗi khi upload tệp', undefined, 500);
    }
  }
}