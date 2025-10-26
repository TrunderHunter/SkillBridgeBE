import { Message, IMessage } from '../../models/Message';
import { Conversation, IConversation } from '../../models/Conversation';
import { ContactRequest } from '../../models/ContactRequest';
import { User } from '../../models/User';
import { getSocketInstance } from '../../config/socket';

export interface ICreateMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';
  fileMetadata?: {
    originalName: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileUrl: string;
  };
  replyTo?: {
    messageId: string;
    content: string;
  };
}

export interface IMessagePaginationOptions {
  page?: number;
  limit?: number;
}

export class MessageService {
  // Create a new conversation when contact request is accepted
  static async createConversation(contactRequestId: string): Promise<any> {
    try {
      // Check if conversation already exists
      const existingConversation = await Conversation.findOne({ contactRequestId });
      if (existingConversation) {
        return {
          success: true,
          message: 'Cuộc trò chuyện đã tồn tại',
          data: existingConversation,
        };
      }

      // Get contact request details
      const contactRequest = await ContactRequest.findById(contactRequestId)
        .populate('studentId', 'full_name avatar_url')
        .populate('tutorId', 'full_name avatar_url')
        .populate('tutorPostId', 'title subjects');

      if (!contactRequest) {
        return {
          success: false,
          message: 'Không tìm thấy yêu cầu liên hệ',
        };
      }

      // Create new conversation
      const conversation = new Conversation({
        contactRequestId,
        studentId: contactRequest.studentId,
        tutorId: contactRequest.tutorId,
        tutorPostId: contactRequest.tutorPostId,
        subject: contactRequest.subject,
        status: 'ACTIVE',
      });

      await conversation.save();

      // Populate conversation data
      const populatedConversation = await Conversation.findById(conversation._id)
        .populate('studentId', 'full_name avatar_url')
        .populate('tutorId', 'full_name avatar_url')
        .populate('tutorPostId', 'title subjects')
        .populate('subject', 'name');

      return {
        success: true,
        message: 'Tạo cuộc trò chuyện thành công',
        data: populatedConversation,
      };
    } catch (error: any) {
      console.error('❌ Create conversation error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi tạo cuộc trò chuyện',
      };
    }
  }

  // Send a message
  static async sendMessage(messageData: ICreateMessageInput): Promise<any> {
    try {
      // Verify conversation exists and user has access
      const conversation = await Conversation.findById(messageData.conversationId);
      if (!conversation) {
        return {
          success: false,
          message: 'Không tìm thấy cuộc trò chuyện',
        };
      }

      // Check if sender is part of the conversation
      if (conversation.studentId !== messageData.senderId && conversation.tutorId !== messageData.senderId) {
        return {
          success: false,
          message: 'Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này',
        };
      }

      // Determine receiver
      const receiverId = conversation.studentId === messageData.senderId 
        ? conversation.tutorId 
        : conversation.studentId;

      // Create message
      const message = new Message({
        conversationId: messageData.conversationId,
        senderId: messageData.senderId,
        receiverId,
        content: messageData.content,
        messageType: messageData.messageType || 'TEXT',
        fileMetadata: messageData.fileMetadata,
        replyTo: messageData.replyTo,
        status: 'SENT',
      });

      await message.save();

      // Update conversation's last message and unread count
      const isStudentSender = conversation.studentId === messageData.senderId;
      const updateData: any = {
        lastMessage: {
          content: messageData.content,
          senderId: messageData.senderId,
          sentAt: message.sentAt,
          messageType: messageData.messageType || 'TEXT',
        },
      };

      if (isStudentSender) {
        updateData['unreadCount.tutor'] = conversation.unreadCount.tutor + 1;
      } else {
        updateData['unreadCount.student'] = conversation.unreadCount.student + 1;
      }

      await Conversation.findByIdAndUpdate(messageData.conversationId, updateData);

      // Populate message data
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'full_name avatar_url')
        .populate('receiverId', 'full_name avatar_url');

      // Send real-time notification via socket
      const io = getSocketInstance();
      if (io) {
        // Send to receiver's notification room
        io.to(`notifications-${receiverId}`).emit('new-message', {
          message: populatedMessage,
          conversationId: messageData.conversationId,
        });

        // Send to conversation room if both users are online
        io.to(`conversation-${messageData.conversationId}`).emit('message-received', populatedMessage);
      }

      return {
        success: true,
        message: 'Gửi tin nhắn thành công',
        data: populatedMessage,
      };
    } catch (error: any) {
      console.error('❌ Send message error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi gửi tin nhắn',
      };
    }
  }

  // Get messages in a conversation
  static async getMessages(
    conversationId: string,
    userId: string,
    options: IMessagePaginationOptions = {}
  ): Promise<any> {
    try {
      const { page = 1, limit = 50 } = options;

      // Verify user has access to conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return {
          success: false,
          message: 'Không tìm thấy cuộc trò chuyện',
        };
      }

      if (conversation.studentId !== userId && conversation.tutorId !== userId) {
        return {
          success: false,
          message: 'Bạn không có quyền xem cuộc trò chuyện này',
        };
      }

      // Get messages with pagination
      const skip = (page - 1) * limit;
      const messages = await Message.find({
        conversationId,
        isDeleted: false,
      })
        .populate('senderId', 'full_name avatar_url')
        .populate('receiverId', 'full_name avatar_url')
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalMessages = await Message.countDocuments({
        conversationId,
        isDeleted: false,
      });

      const totalPages = Math.ceil(totalMessages / limit);

      return {
        success: true,
        message: 'Lấy tin nhắn thành công',
        data: {
          messages: messages.reverse(), // Reverse to show oldest first
          pagination: {
            page,
            limit,
            total: totalMessages,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
      };
    } catch (error: any) {
      console.error('❌ Get messages error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy tin nhắn',
      };
    }
  }

  // Get user's conversations
  static async getUserConversations(userId: string): Promise<any> {
    try {
      const conversations = await Conversation.find({
        $or: [{ studentId: userId }, { tutorId: userId }],
        status: 'ACTIVE',
      })
        .populate('studentId', 'full_name avatar_url')
        .populate('tutorId', 'full_name avatar_url')
        .populate('tutorPostId', 'title')
        .populate('subject', 'name')
        .sort({ updatedAt: -1 });

      return {
        success: true,
        message: 'Lấy danh sách cuộc trò chuyện thành công',
        data: conversations,
      };
    } catch (error: any) {
      console.error('❌ Get user conversations error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách cuộc trò chuyện',
      };
    }
  }

  // Mark messages as read
  static async markMessagesAsRead(conversationId: string, userId: string): Promise<any> {
    try {
      // Verify user has access to conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return {
          success: false,
          message: 'Không tìm thấy cuộc trò chuyện',
        };
      }

      if (conversation.studentId !== userId && conversation.tutorId !== userId) {
        return {
          success: false,
          message: 'Bạn không có quyền truy cập cuộc trò chuyện này',
        };
      }

      // Mark unread messages as read
      await Message.updateMany(
        {
          conversationId,
          receiverId: userId,
          status: { $ne: 'READ' },
        },
        {
          status: 'READ',
          readAt: new Date(),
        }
      );

      // Reset unread count for this user
      const isStudent = conversation.studentId === userId;
      const updateData = isStudent
        ? { 'unreadCount.student': 0 }
        : { 'unreadCount.tutor': 0 };

      await Conversation.findByIdAndUpdate(conversationId, updateData);

      // Notify sender via socket that messages were read
      const io = getSocketInstance();
      if (io) {
        const senderId = isStudent ? conversation.tutorId : conversation.studentId;
        io.to(`notifications-${senderId}`).emit('messages-read', {
          conversationId,
          readBy: userId,
        });
      }

      return {
        success: true,
        message: 'Đánh dấu tin nhắn đã đọc thành công',
      };
    } catch (error: any) {
      console.error('❌ Mark messages as read error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi đánh dấu tin nhắn đã đọc',
      };
    }
  }

  // Close conversation
  static async closeConversation(conversationId: string, userId: string): Promise<any> {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return {
          success: false,
          message: 'Không tìm thấy cuộc trò chuyện',
        };
      }

      if (conversation.studentId !== userId && conversation.tutorId !== userId) {
        return {
          success: false,
          message: 'Bạn không có quyền đóng cuộc trò chuyện này',
        };
      }

      await Conversation.findByIdAndUpdate(conversationId, {
        status: 'CLOSED',
        closedAt: new Date(),
      });

      return {
        success: true,
        message: 'Đóng cuộc trò chuyện thành công',
      };
    } catch (error: any) {
      console.error('❌ Close conversation error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi đóng cuộc trò chuyện',
      };
    }
  }
}