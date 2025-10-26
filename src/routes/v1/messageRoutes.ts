import { Router } from 'express';
import { body, param } from 'express-validator';
import { MessageController } from '../../controllers/message/message.controller';
import { authenticateToken } from '../../middlewares/auth.middleware';

const router = Router();

// Validation middleware
const createConversationValidation = [
  body('contactRequestId')
    .notEmpty()
    .withMessage('Contact request ID là bắt buộc')
    .isUUID(4)
    .withMessage('Contact request ID không hợp lệ'),
];

const sendMessageValidation = [
  param('conversationId')
    .isUUID(4)
    .withMessage('Conversation ID không hợp lệ'),
  body('content')
    .notEmpty()
    .withMessage('Nội dung tin nhắn là bắt buộc')
    .isLength({ max: 2000 })
    .withMessage('Nội dung tin nhắn không được vượt quá 2000 ký tự'),
  body('messageType')
    .optional()
    .isIn(['text', 'image', 'file', 'TEXT', 'IMAGE', 'FILE'])
    .withMessage('Loại tin nhắn không hợp lệ'),
  body('fileMetadata')
    .optional()
    .isObject()
    .withMessage('Metadata file không hợp lệ'),
  body('replyTo.messageId')
    .optional()
    .isUUID(4)
    .withMessage('Reply to message ID không hợp lệ'),
];

const conversationIdValidation = [
  param('conversationId')
    .isUUID(4)
    .withMessage('Conversation ID không hợp lệ'),
];

const contactRequestIdValidation = [
  param('contactRequestId')
    .isUUID(4)
    .withMessage('Contact request ID không hợp lệ'),
];

// Routes
// Create conversation (usually called when contact request is accepted)
router.post(
  '/conversations',
  authenticateToken,
  createConversationValidation,
  MessageController.createConversation
);

// Send message
router.post(
  '/conversations/:conversationId/messages',
  authenticateToken,
  sendMessageValidation,
  MessageController.sendMessage
);

// Get messages in conversation
router.get(
  '/conversations/:conversationId/messages',
  authenticateToken,
  conversationIdValidation,
  MessageController.getMessages
);

// Get user's conversations
router.get(
  '/conversations',
  authenticateToken,
  MessageController.getUserConversations
);

// Mark messages as read
router.patch(
  '/conversations/:conversationId/read',
  authenticateToken,
  conversationIdValidation,
  MessageController.markMessagesAsRead
);

// Close conversation
router.patch(
  '/conversations/:conversationId/close',
  authenticateToken,
  conversationIdValidation,
  MessageController.closeConversation
);

// Get conversation by contact request ID
router.get(
  '/conversations/contact-request/:contactRequestId',
  authenticateToken,
  contactRequestIdValidation,
  MessageController.getConversationByContactRequest
);

export default router;