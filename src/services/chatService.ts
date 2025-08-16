import { Chat } from '../models';
import { IChat, IChatMessage, ChatTopic, StartChatRequest } from '../types';

/**
 * Chat Service
 * Handles chat session creation, management, and message operations
 */

/**
 * Create a new chat session
 * @param userId - User ID
 * @param chatData - Chat initialization data
 * @returns Created chat document
 */
export const createChat = async (
  userId: string,
  chatData: StartChatRequest
): Promise<IChat> => {
  try {
    // Validate topics
    if (!chatData.topics || chatData.topics.length === 0) {
      throw new Error('At least one topic is required');
    }
    
    if (chatData.topics.length > 2) {
      throw new Error('Maximum 2 topics allowed per chat');
    }
    
    // Validate topic values
    const validTopics = Object.values(ChatTopic);
    for (const topic of chatData.topics) {
      if (!validTopics.includes(topic)) {
        throw new Error(`Invalid topic: ${topic}`);
      }
    }
    
    // Generate title if not provided
    const title = chatData.title || `${chatData.topics.join(' & ')} Chat`;
    
    // Create new chat
    const chat = await Chat.createNewChat(userId, chatData.topics, title);
    
    console.log(`New chat created for user: ${userId}, topics: ${chatData.topics.join(', ')}`);
    return chat;
  } catch (error) {
    console.error('Error creating chat:', error);
    throw error;
  }
};

/**
 * Get chat by ID with user validation
 * @param chatId - Chat ID
 * @param userId - User ID
 * @returns Chat document or null
 */
export const getChatById = async (chatId: string, userId: string): Promise<IChat | null> => {
  try {
    const chat = await Chat.findChatWithMessages(chatId, userId);
    return chat;
  } catch (error) {
    console.error('Error fetching chat:', error);
    return null;
  }
};

/**
 * Get all chats for a user
 * @param userId - User ID
 * @param limit - Maximum number of chats to return
 * @returns Array of chat documents
 */
export const getUserChats = async (userId: string, limit: number = 20): Promise<IChat[]> => {
  try {
    const chats = await Chat.findUserChats(userId, limit);
    return chats;
  } catch (error) {
    console.error('Error fetching user chats:', error);
    return [];
  }
};

/**
 * Add a message to a chat
 * @param chatId - Chat ID
 * @param userId - User ID
 * @param message - Message data
 * @returns Updated chat document
 */
export const addMessageToChat = async (
  chatId: string,
  userId: string,
  message: Omit<IChatMessage, 'timestamp' | 'messageId'>
): Promise<IChat | null> => {
  try {
    const chat = await Chat.findOne({ _id: chatId, userId, isActive: true });
    
    if (!chat) {
      throw new Error('Chat not found or access denied');
    }
    
    // Add message to chat
    await chat.addMessage(message);
    
    return chat;
  } catch (error) {
    console.error('Error adding message to chat:', error);
    throw error;
  }
};

/**
 * Get chat message history
 * @param chatId - Chat ID
 * @param userId - User ID
 * @param limit - Maximum number of messages to return
 * @returns Array of messages
 */
export const getChatHistory = async (
  chatId: string,
  userId: string,
  limit: number = 50
): Promise<IChatMessage[]> => {
  try {
    const chat = await Chat.findOne({ _id: chatId, userId, isActive: true });
    
    if (!chat) {
      throw new Error('Chat not found or access denied');
    }
    
    return chat.getMessageHistory(limit);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    throw error;
  }
};

/**
 * Delete a chat (soft delete)
 * @param chatId - Chat ID
 * @param userId - User ID
 * @returns Success status
 */
export const deleteChat = async (chatId: string, userId: string): Promise<boolean> => {
  try {
    const chat = await Chat.findOne({ _id: chatId, userId, isActive: true });
    
    if (!chat) {
      return false;
    }
    
    await chat.deactivate();
    console.log(`Chat deleted: ${chatId} for user: ${userId}`);
    return true;
  } catch (error) {
    console.error('Error deleting chat:', error);
    return false;
  }
};

/**
 * Update chat title
 * @param chatId - Chat ID
 * @param userId - User ID
 * @param newTitle - New chat title
 * @returns Updated chat document
 */
export const updateChatTitle = async (
  chatId: string,
  userId: string,
  newTitle: string
): Promise<IChat | null> => {
  try {
    const chat = await Chat.findOne({ _id: chatId, userId, isActive: true });
    
    if (!chat) {
      throw new Error('Chat not found or access denied');
    }
    
    chat.title = newTitle.trim();
    await chat.save();
    
    console.log(`Chat title updated: ${chatId} for user: ${userId}`);
    return chat;
  } catch (error) {
    console.error('Error updating chat title:', error);
    throw error;
  }
};

/**
 * Get chat statistics for a user
 * @param userId - User ID
 * @returns Chat statistics
 */
export const getChatStats = async (userId: string): Promise<{
  totalChats: number;
  activeChats: number;
  totalMessages: number;
  topicBreakdown: { [key in ChatTopic]?: number };
  recentActivity: Date | null;
}> => {
  try {
    const chats = await Chat.find({ userId });
    const activeChats = chats.filter(chat => chat.isActive);
    
    let totalMessages = 0;
    const topicBreakdown: { [key in ChatTopic]?: number } = {};
    let recentActivity: Date | null = null;
    
    for (const chat of activeChats) {
      totalMessages += chat.messages.length;
      
      // Count topics
      for (const topic of chat.topics) {
        topicBreakdown[topic] = (topicBreakdown[topic] || 0) + 1;
      }
      
      // Track most recent activity
      if (chat.lastMessageAt && (!recentActivity || chat.lastMessageAt > recentActivity)) {
        recentActivity = chat.lastMessageAt;
      }
    }
    
    return {
      totalChats: chats.length,
      activeChats: activeChats.length,
      totalMessages,
      topicBreakdown,
      recentActivity,
    };
  } catch (error) {
    console.error('Error getting chat stats:', error);
    return {
      totalChats: 0,
      activeChats: 0,
      totalMessages: 0,
      topicBreakdown: {},
      recentActivity: null,
    };
  }
};

/**
 * Search chats by title or content
 * @param userId - User ID
 * @param query - Search query
 * @param limit - Maximum number of results
 * @returns Array of matching chats
 */
export const searchChats = async (
  userId: string,
  query: string,
  limit: number = 10
): Promise<IChat[]> => {
  try {
    const searchRegex = new RegExp(query, 'i'); // Case-insensitive search
    
    const chats = await Chat.find({
      userId,
      isActive: true,
      $or: [
        { title: { $regex: searchRegex } },
        { 'messages.text': { $regex: searchRegex } },
      ],
    })
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .populate('userId', 'name email');
    
    return chats;
  } catch (error) {
    console.error('Error searching chats:', error);
    return [];
  }
};

/**
 * Validate chat data
 * @param chatData - Chat data to validate
 * @returns Validation result
 */
export const validateChatData = (chatData: StartChatRequest): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  // Validate topics
  if (!chatData.topics || !Array.isArray(chatData.topics)) {
    errors.push('Topics must be an array');
  } else {
    if (chatData.topics.length === 0) {
      errors.push('At least one topic is required');
    } else if (chatData.topics.length > 2) {
      errors.push('Maximum 2 topics allowed');
    }
    
    const validTopics = Object.values(ChatTopic);
    for (const topic of chatData.topics) {
      if (!validTopics.includes(topic)) {
        errors.push(`Invalid topic: ${topic}`);
      }
    }
  }
  
  // Validate title (optional)
  if (chatData.title && typeof chatData.title !== 'string') {
    errors.push('Title must be a string');
  } else if (chatData.title && chatData.title.trim().length > 100) {
    errors.push('Title cannot exceed 100 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};
