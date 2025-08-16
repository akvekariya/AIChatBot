import express, { Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import {
  createChat,
  getChatById,
  getUserChats,
  deleteChat,
  updateChatTitle,
  getChatStats,
  searchChats,
  validateChatData,
} from '../services/chatService';
import { ApiResponse, StartChatRequest, ChatTopic } from '../types';

/**
 * Chat Management Routes
 * Handles chat session creation, retrieval, and management endpoints
 */

const router = express.Router();

/**
 * POST /api/chats/start
 * Create a new chat session with selected topics
 */
router.post(
  '/start',
  authenticateToken,
  [
    body('topics')
      .isArray({ min: 1, max: 2 })
      .withMessage('Topics must be an array with 1-2 items')
      .custom((topics) => {
        const validTopics = Object.values(ChatTopic);
        for (const topic of topics) {
          if (!validTopics.includes(topic)) {
            throw new Error(`Invalid topic: ${topic}`);
          }
        }
        return true;
      }),
    
    body('title')
      .optional()
      .isString()
      .withMessage('Title must be a string')
      .isLength({ max: 100 })
      .withMessage('Title cannot exceed 100 characters')
      .trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: 'VALIDATION_ERROR',
          data: errors.array(),
        } as ApiResponse);
        return;
      }
      
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'NOT_AUTHENTICATED',
        } as ApiResponse);
        return;
      }
      
      const chatData: StartChatRequest = {
        topics: req.body.topics,
        title: req.body.title,
      };
      
      // Additional validation
      const validation = validateChatData(chatData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: 'Chat validation failed',
          error: 'CHAT_VALIDATION_ERROR',
          data: validation.errors,
        } as ApiResponse);
        return;
      }
      
      // Create chat
      const chat = await createChat(req.userId, chatData);
      
      res.status(201).json({
        success: true,
        message: 'Chat session created successfully',
        data: {
          id: chat._id,
          title: chat.title,
          topics: chat.topics,
          messages: chat.messages,
          createdAt: chat.createdAt,
          lastMessageAt: chat.lastMessageAt,
        },
      } as ApiResponse);
      
    } catch (error) {
      console.error('Create chat error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('topic') || error.message.includes('required')) {
          res.status(400).json({
            success: false,
            message: error.message,
            error: 'VALIDATION_ERROR',
          } as ApiResponse);
          return;
        }
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create chat session',
        error: 'CHAT_CREATION_ERROR',
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/chats
 * Get all chats for the authenticated user
 */
router.get(
  '/',
  authenticateToken,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    query('search')
      .optional()
      .isString()
      .withMessage('Search query must be a string')
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: 'VALIDATION_ERROR',
          data: errors.array(),
        } as ApiResponse);
        return;
      }
      
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'NOT_AUTHENTICATED',
        } as ApiResponse);
        return;
      }
      
      const limit = parseInt(req.query.limit as string) || 20;
      const searchQuery = req.query.search as string;
      
      let chats;
      
      if (searchQuery) {
        // Search chats
        chats = await searchChats(req.userId, searchQuery, limit);
      } else {
        // Get all user chats
        chats = await getUserChats(req.userId, limit);
      }
      
      // Format response data
      const formattedChats = chats.map(chat => ({
        id: chat._id,
        title: chat.title,
        topics: chat.topics,
        messageCount: chat.messages?.length || 0,
        lastMessageAt: chat.lastMessageAt,
        createdAt: chat.createdAt,
        lastMessage: chat.messages && chat.messages.length > 0
          ? chat.messages[chat.messages.length - 1]
          : null,
      }));
      
      res.status(200).json({
        success: true,
        message: searchQuery 
          ? `Found ${formattedChats.length} chats matching "${searchQuery}"` 
          : 'Chats retrieved successfully',
        data: {
          chats: formattedChats,
          total: formattedChats.length,
          hasMore: formattedChats.length === limit,
        },
      } as ApiResponse);
      
    } catch (error) {
      console.error('Get chats error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve chats',
        error: 'CHAT_RETRIEVAL_ERROR',
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/chats/:chatId
 * Get a specific chat with full message history
 */
router.get(
  '/:chatId',
  authenticateToken,
  [
    param('chatId')
      .isMongoId()
      .withMessage('Invalid chat ID format'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: 'VALIDATION_ERROR',
          data: errors.array(),
        } as ApiResponse);
        return;
      }
      
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'NOT_AUTHENTICATED',
        } as ApiResponse);
        return;
      }
      
      const { chatId } = req.params;
      const chat = await getChatById(chatId, req.userId);
      
      if (!chat) {
        res.status(404).json({
          success: false,
          message: 'Chat not found or access denied',
          error: 'CHAT_NOT_FOUND',
        } as ApiResponse);
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Chat retrieved successfully',
        data: {
          id: chat._id,
          title: chat.title,
          topics: chat.topics,
          messages: chat.messages || [],
          messageCount: chat.messages?.length || 0,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          lastMessageAt: chat.lastMessageAt,
        },
      } as ApiResponse);
      
    } catch (error) {
      console.error('Get chat error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve chat',
        error: 'CHAT_RETRIEVAL_ERROR',
      } as ApiResponse);
    }
  }
);

/**
 * DELETE /api/chats/:chatId
 * Delete a specific chat (soft delete)
 */
router.delete(
  '/:chatId',
  authenticateToken,
  [
    param('chatId')
      .isMongoId()
      .withMessage('Invalid chat ID format'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: 'VALIDATION_ERROR',
          data: errors.array(),
        } as ApiResponse);
        return;
      }
      
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'NOT_AUTHENTICATED',
        } as ApiResponse);
        return;
      }
      
      const { chatId } = req.params;
      const deleted = await deleteChat(chatId, req.userId);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Chat not found or access denied',
          error: 'CHAT_NOT_FOUND',
        } as ApiResponse);
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Chat deleted successfully',
        data: {
          deleted: true,
          chatId,
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
      
    } catch (error) {
      console.error('Delete chat error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete chat',
        error: 'CHAT_DELETION_ERROR',
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/chats/new
 * Create a fresh chat session (alias for /start)
 */
router.post('/new', (req: Request, _res: Response, next) => {
  // Redirect to the start endpoint
  req.url = '/start';
  next();
});

/**
 * PUT /api/chats/:chatId/title
 * Update chat title
 */
router.put(
  '/:chatId/title',
  authenticateToken,
  [
    param('chatId')
      .isMongoId()
      .withMessage('Invalid chat ID format'),
    
    body('title')
      .notEmpty()
      .withMessage('Title is required')
      .isString()
      .withMessage('Title must be a string')
      .isLength({ min: 1, max: 100 })
      .withMessage('Title must be between 1 and 100 characters')
      .trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: 'VALIDATION_ERROR',
          data: errors.array(),
        } as ApiResponse);
        return;
      }
      
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'NOT_AUTHENTICATED',
        } as ApiResponse);
        return;
      }
      
      const { chatId } = req.params;
      const { title } = req.body;
      
      const chat = await updateChatTitle(chatId, req.userId, title);
      
      if (!chat) {
        res.status(404).json({
          success: false,
          message: 'Chat not found or access denied',
          error: 'CHAT_NOT_FOUND',
        } as ApiResponse);
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Chat title updated successfully',
        data: {
          id: chat._id,
          title: chat.title,
          updatedAt: chat.updatedAt,
        },
      } as ApiResponse);
      
    } catch (error) {
      console.error('Update chat title error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to update chat title',
        error: 'CHAT_UPDATE_ERROR',
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/chats/stats
 * Get chat statistics for the authenticated user
 */
router.get(
  '/stats',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'NOT_AUTHENTICATED',
        } as ApiResponse);
        return;
      }
      
      const stats = await getChatStats(req.userId);
      
      res.status(200).json({
        success: true,
        message: 'Chat statistics retrieved successfully',
        data: stats,
      } as ApiResponse);
      
    } catch (error) {
      console.error('Get chat stats error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve chat statistics',
        error: 'CHAT_STATS_ERROR',
      } as ApiResponse);
    }
  }
);

export default router;
