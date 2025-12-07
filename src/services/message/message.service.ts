import { Message, IMessage } from '../../models/Message';
import { Conversation, IConversation } from '../../models/Conversation';
import { ContactRequest } from '../../models/ContactRequest';
import { User } from '../../models/User';
import { getSocketInstance } from '../../config/socket';
import { notifyNewMessage } from '../notification/notification.helpers';
import {
  filterSensitiveContent,
  getFilterErrorMessage,
} from '../../utils/contentFilter';

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
  // Get or create conversation by class ID (more reliable than contactRequestId)
  static async getOrCreateConversationByClass(classId: string): Promise<any> {
    try {
      const { LearningClass } = await import('../../models/LearningClass');
      const learningClass = await LearningClass.findById(classId)
        .populate('studentId', 'full_name avatar_url')
        .populate('tutorId', 'full_name avatar_url')
        .populate('tutorPostId', 'title')
        .populate('subject', 'name');

      if (!learningClass) {
        return {
          success: false,
          message: 'Không tìm thấy lớp học',
        };
      }

      // Extract ObjectIds from populated fields
      const studentIdStr =
        typeof learningClass.studentId === 'object'
          ? (learningClass.studentId as any)._id
          : learningClass.studentId;
      const tutorIdStr =
        typeof learningClass.tutorId === 'object'
          ? (learningClass.tutorId as any)._id
          : learningClass.tutorId;
      const tutorPostIdStr =
        typeof learningClass.tutorPostId === 'object'
          ? (learningClass.tutorPostId as any)._id
          : learningClass.tutorPostId;
      const subjectIdStr =
        typeof learningClass.subject === 'object'
          ? (learningClass.subject as any)._id
          : learningClass.subject;

      // Try to find existing conversation by studentId and tutorId
      const existingConversation = await Conversation.findOne({
        studentId: studentIdStr,
        tutorId: tutorIdStr,
        tutorPostId: tutorPostIdStr,
      })
        .populate('studentId', 'full_name avatar_url')
        .populate('tutorId', 'full_name avatar_url')
        .populate('tutorPostId', 'title')
        .populate('subject', 'name');

      if (existingConversation) {
        return {
          success: true,
          message: 'Cuộc trò chuyện đã tồn tại',
          data: existingConversation,
        };
      }

      // Create new conversation
      const conversation = new Conversation({
        contactRequestId: learningClass.contactRequestId,
        studentId: studentIdStr,
        tutorId: tutorIdStr,
        tutorPostId: tutorPostIdStr,
        subject: subjectIdStr,
        status: 'ACTIVE',
      });

      await conversation.save();

      // Populate conversation data
      const populatedConversation = await Conversation.findById(
        conversation._id
      )
        .populate('studentId', 'full_name avatar_url')
        .populate('tutorId', 'full_name avatar_url')
        .populate('tutorPostId', 'title')
        .populate('subject', 'name');

      return {
        success: true,
        message: 'Tạo cuộc trò chuyện thành công',
        data: populatedConversation,
      };
    } catch (error: any) {
      console.error('❌ Create conversation by class error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi tạo cuộc trò chuyện',
      };
    }
  }

  // Create a new conversation when contact request is accepted
  static async createConversation(contactRequestId: string): Promise<any> {
    try {
      const existingConversation = await Conversation.findOne({
        contactRequestId,
      });

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
      const populatedConversation = await Conversation.findById(
        conversation._id
      )
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

  // Create conversation from class (when tutor/student want to chat about existing class)
  static async createConversationFromClass(classId: string): Promise<any> {
    try {
      const { LearningClass } = await import('../../models/LearningClass');

      // Get class details - NO POPULATE to keep IDs as strings
      const learningClass = await LearningClass.findById(classId);

      if (!learningClass) {
        return {
          success: false,
          message: 'Không tìm thấy lớp học',
        };
      }

      // Extract IDs as strings
      const studentIdStr = learningClass.studentId.toString();
      const tutorIdStr = learningClass.tutorId.toString();
      const subjectIdStr = learningClass.subject.toString();

      // Check if conversation already exists between tutor and student (ANY status, both directions)
      let existingConversation = await Conversation.findOne({
        $or: [
          { studentId: studentIdStr, tutorId: tutorIdStr },
          { studentId: tutorIdStr, tutorId: studentIdStr }, // Check both directions just in case
        ],
      });

      if (existingConversation) {
        // Reactivate if closed
        if (existingConversation.status !== 'ACTIVE') {
          existingConversation.status = 'ACTIVE';
          await existingConversation.save();
        }

        // Populate and return
        existingConversation = await Conversation.findById(
          existingConversation._id
        )
          .populate('studentId', 'full_name avatar_url')
          .populate('tutorId', 'full_name avatar_url')
          .populate('tutorPostId', 'title')
          .populate('subject', 'name');

        return {
          success: true,
          message: 'Cuộc trò chuyện đã tồn tại',
          data: existingConversation,
        };
      }

      // Try to find an existing contact request to link with
      let contactRequest = await ContactRequest.findOne({
        studentId: studentIdStr,
        tutorId: tutorIdStr,
      }).sort({ createdAt: -1 });

      // Find a tutor post to associate with
      const { TutorPost } = await import('../../models/TutorPost');
      let tutorPost = await TutorPost.findOne({
        tutorId: tutorIdStr,
        subjects: subjectIdStr,
        status: 'ACTIVE',
      });

      // If no matching tutor post, find any active post by this tutor
      if (!tutorPost) {
        tutorPost = await TutorPost.findOne({
          tutorId: tutorIdStr,
          status: 'ACTIVE',
        });
      }

      // Create conversation directly (they have a class together, so they can chat)
      const conversationData: any = {
        studentId: studentIdStr,
        tutorId: tutorIdStr,
        subject: subjectIdStr, // Save the subject ID as string
        status: 'ACTIVE',
      };

      // If we have a contact request, link it
      if (contactRequest) {
        conversationData.contactRequestId = contactRequest._id;
        conversationData.tutorPostId = contactRequest.tutorPostId;
      } else {
        // No contact request - use class ID as reference and tutor post if available
        conversationData.contactRequestId = `from-class-${classId}`;
        conversationData.tutorPostId = tutorPost
          ? tutorPost._id.toString()
          : `virtual-post-${tutorIdStr}`;
      }

      // Try to create, handle duplicate key error gracefully
      let conversation;
      try {
        conversation = new Conversation(conversationData);
        await conversation.save();
      } catch (error: any) {
        // If duplicate key error (code 11000), fetch the existing conversation
        if (error.code === 11000) {
          console.log(
            '⚠️ Duplicate conversation detected, fetching existing one'
          );
          existingConversation = await Conversation.findOne({
            $or: [
              { studentId: studentIdStr, tutorId: tutorIdStr },
              { studentId: tutorIdStr, tutorId: studentIdStr },
            ],
          })
            .populate('studentId', 'full_name avatar_url')
            .populate('tutorId', 'full_name avatar_url')
            .populate('tutorPostId', 'title')
            .populate('subject', 'name');

          return {
            success: true,
            message: 'Cuộc trò chuyện đã tồn tại',
            data: existingConversation,
          };
        }
        throw error;
      }

      // Populate conversation data
      const populatedConversation = await Conversation.findById(
        conversation._id
      )
        .populate('studentId', 'full_name avatar_url')
        .populate('tutorId', 'full_name avatar_url')
        .populate('tutorPostId', 'title')
        .populate('subject', 'name');

      return {
        success: true,
        message: 'Tạo cuộc trò chuyện thành công',
        data: populatedConversation,
      };
    } catch (error: any) {
      console.error('❌ Create conversation from class error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi tạo cuộc trò chuyện từ lớp học',
      };
    }
  }

  // Send a message
  static async sendMessage(messageData: ICreateMessageInput): Promise<any> {
    try {
      // Verify conversation exists and user has access
      const conversation = await Conversation.findById(
        messageData.conversationId
      );
      if (!conversation) {
        return {
          success: false,
          message: 'Không tìm thấy cuộc trò chuyện',
        };
      }

      // Check if sender is part of the conversation
      if (
        conversation.studentId !== messageData.senderId &&
        conversation.tutorId !== messageData.senderId
      ) {
        return {
          success: false,
          message: 'Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này',
        };
      }

      // Determine receiver
      const receiverId =
        conversation.studentId === messageData.senderId
          ? conversation.tutorId
          : conversation.studentId;

      // Kiểm tra và lọc nội dung nhạy cảm (chỉ áp dụng cho tin nhắn TEXT)
      if (messageData.messageType === 'TEXT' || !messageData.messageType) {
        const filterResult = filterSensitiveContent(messageData.content, true);

        if (!filterResult.isValid) {
          return {
            success: false,
            message: getFilterErrorMessage(filterResult.violations),
          };
        }
      }

      // Create message
      const message = new Message({
        conversationId: messageData.conversationId,
        senderId: messageData.senderId,
        receiverId,
        content: messageData.content,
        messageType: (messageData.messageType || 'TEXT').toUpperCase() as
          | 'TEXT'
          | 'IMAGE'
          | 'FILE',
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
          messageType: (messageData.messageType || 'TEXT').toUpperCase() as
            | 'TEXT'
            | 'IMAGE'
            | 'FILE',
        },
      };

      if (isStudentSender) {
        updateData['unreadCount.tutor'] = conversation.unreadCount.tutor + 1;
      } else {
        updateData['unreadCount.student'] =
          conversation.unreadCount.student + 1;
      }

      await Conversation.findByIdAndUpdate(
        messageData.conversationId,
        updateData
      );

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
        io.to(`conversation-${messageData.conversationId}`).emit(
          'message-received',
          populatedMessage
        );
      }

      // Send notification to receiver
      try {
        const sender = await User.findById(messageData.senderId);
        const senderName = sender?.full_name || sender?.email || 'Người dùng';
        const messagePreview =
          messageData.content.length > 50
            ? messageData.content.substring(0, 50) + '...'
            : messageData.content;

        await notifyNewMessage(
          receiverId.toString(),
          senderName,
          messagePreview,
          messageData.conversationId
        );
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
        // Don't throw error, just log it
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

      if (
        conversation.studentId !== userId &&
        conversation.tutorId !== userId
      ) {
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
      // Get conversations without populate first to check for bad data
      const rawConversations = await Conversation.find({
        $or: [{ studentId: userId }, { tutorId: userId }],
        status: 'ACTIVE',
      }).lean();

      // Filter out conversations with invalid subject (stringified object)
      const validConversationIds = rawConversations
        .filter((conv) => {
          // Check if subject is a valid ObjectId string (24 hex chars)
          const subjectStr = conv.subject?.toString() || '';
          return /^[0-9a-fA-F]{24}$/.test(subjectStr);
        })
        .map((conv) => conv._id);

      // Delete invalid conversations
      const invalidCount =
        rawConversations.length - validConversationIds.length;
      if (invalidCount > 0) {
        await Conversation.deleteMany({
          _id: { $nin: validConversationIds },
          $or: [{ studentId: userId }, { tutorId: userId }],
          status: 'ACTIVE',
        });
        console.log(`🗑️ Deleted ${invalidCount} invalid conversations`);
      }

      // Now get valid conversations with populate
      const conversations = await Conversation.find({
        _id: { $in: validConversationIds },
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
  static async markMessagesAsRead(
    conversationId: string,
    userId: string
  ): Promise<any> {
    try {
      // Verify user has access to conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return {
          success: false,
          message: 'Không tìm thấy cuộc trò chuyện',
        };
      }

      if (
        conversation.studentId !== userId &&
        conversation.tutorId !== userId
      ) {
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
        const senderId = isStudent
          ? conversation.tutorId
          : conversation.studentId;
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
  static async closeConversation(
    conversationId: string,
    userId: string
  ): Promise<any> {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return {
          success: false,
          message: 'Không tìm thấy cuộc trò chuyện',
        };
      }

      if (
        conversation.studentId !== userId &&
        conversation.tutorId !== userId
      ) {
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
