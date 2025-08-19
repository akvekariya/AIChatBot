import { Chat } from '../models';
import { IChat, IUserInfo } from '../types';

/**
 * Session Memory Service
 * Manages context retention and user information extraction within chat sessions
 */

export class SessionMemoryService {
  
  /**
   * Extract and store user information from a message
   * @param chatId - Chat ID
   * @param message - User message text
   * @param sender - Message sender ('user' or 'ai')
   */
  static async extractAndStoreUserInfo(
    chatId: string, 
    message: string, 
    sender: 'user' | 'ai'
  ): Promise<void> {
    if (sender !== 'user') return; // Only process user messages
    
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) return;
      
      const extractedInfo = this.extractUserInfoFromMessage(message);
      
      if (Object.keys(extractedInfo).length > 0) {
        await chat.updateUserInfo(extractedInfo);
        console.log(`Updated user info for chat ${chatId}:`, extractedInfo);
      }
    } catch (error) {
      console.error('Error extracting user info:', error);
    }
  }
  
  /**
   * Extract user information from message text using pattern matching
   * @param message - Message text
   * @returns Extracted user information
   */
  private static extractUserInfoFromMessage(message: string): Partial<IUserInfo> {
    const info: Partial<IUserInfo> = {};
    const lowerMessage = message.toLowerCase();
    
    // Extract name patterns
    const namePatterns = [
      /my name is (\w+)/i,
      /i'm (\w+)/i,
      /i am (\w+)/i,
      /call me (\w+)/i,
      /name's (\w+)/i,
    ];
    
    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        info.name = match[1];
        break;
      }
    }
    
    // Extract interests
    const interestPatterns = [
      /i like (.+?)(?:\.|$|,)/i,
      /i love (.+?)(?:\.|$|,)/i,
      /i enjoy (.+?)(?:\.|$|,)/i,
      /i'm interested in (.+?)(?:\.|$|,)/i,
      /my hobby is (.+?)(?:\.|$|,)/i,
      /my hobbies are (.+?)(?:\.|$|,)/i,
    ];
    
    for (const pattern of interestPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const interest = match[1].trim();
        if (!info.interests) info.interests = [];
        info.interests.push(interest);
      }
    }
    
    // Extract goals
    const goalPatterns = [
      /i want to (.+?)(?:\.|$|,)/i,
      /my goal is (.+?)(?:\.|$|,)/i,
      /i'm trying to (.+?)(?:\.|$|,)/i,
      /i hope to (.+?)(?:\.|$|,)/i,
      /i plan to (.+?)(?:\.|$|,)/i,
    ];
    
    for (const pattern of goalPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const goal = match[1].trim();
        if (!info.goals) info.goals = [];
        info.goals.push(goal);
      }
    }
    
    return info;
  }
  
  /**
   * Store arbitrary context information
   * @param chatId - Chat ID
   * @param key - Context key
   * @param value - Context value
   */
  static async storeContext(chatId: string, key: string, value: any): Promise<void> {
    try {
      const chat = await Chat.findById(chatId);
      if (chat) {
        await chat.updateSessionContext(key, value);
        console.log(`Stored context for chat ${chatId}: ${key} = ${value}`);
      }
    } catch (error) {
      console.error('Error storing context:', error);
    }
  }
  
  /**
   * Retrieve context information
   * @param chatId - Chat ID
   * @param key - Context key
   * @returns Context value or null
   */
  static async getContext(chatId: string, key: string): Promise<any> {
    try {
      const chat = await Chat.findById(chatId);
      if (chat && chat.sessionContext) {
        return chat.sessionContext.get(key);
      }
      return null;
    } catch (error) {
      console.error('Error retrieving context:', error);
      return null;
    }
  }
  
  /**
   * Get user information for a chat
   * @param chatId - Chat ID
   * @returns User information or null
   */
  static async getUserInfo(chatId: string): Promise<IUserInfo | null> {
    try {
      const chat = await Chat.findById(chatId);
      return chat?.userInfo || null;
    } catch (error) {
      console.error('Error retrieving user info:', error);
      return null;
    }
  }
  
  /**
   * Build context string for AI prompt
   * @param chatId - Chat ID
   * @returns Context string for AI
   */
  static async buildContextForAI(chatId: string): Promise<string> {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) return '';
      
      let context = '';
      
      // Add user information
      if (chat.userInfo) {
        const userInfo = chat.userInfo;
        if (userInfo.name) {
          context += `User's name: ${userInfo.name}\n`;
        }
        if (userInfo.interests && userInfo.interests.length > 0) {
          context += `User's interests: ${userInfo.interests.join(', ')}\n`;
        }
        if (userInfo.goals && userInfo.goals.length > 0) {
          context += `User's goals: ${userInfo.goals.join(', ')}\n`;
        }
        if (userInfo.preferences && userInfo.preferences.size > 0) {
          const prefs = Array.from(userInfo.preferences.entries())
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          context += `User's preferences: ${prefs}\n`;
        }
      }
      
      // Add session context
      if (chat.sessionContext && chat.sessionContext.size > 0) {
        context += 'Session context:\n';
        for (const [key, value] of chat.sessionContext.entries()) {
          context += `- ${key}: ${value}\n`;
        }
      }
      
      // Add recent conversation history (last 5 messages for context)
      if (chat.messages && chat.messages.length > 0) {
        const recentMessages = chat.messages.slice(-5);
        context += '\nRecent conversation:\n';
        recentMessages.forEach(msg => {
          context += `${msg.sender}: ${msg.text}\n`;
        });
      }
      
      return context.trim();
    } catch (error) {
      console.error('Error building context for AI:', error);
      return '';
    }
  }
  
  /**
   * Clear session context (useful for new conversations)
   * @param chatId - Chat ID
   */
  static async clearSessionContext(chatId: string): Promise<void> {
    try {
      const chat = await Chat.findById(chatId);
      if (chat) {
        chat.sessionContext = new Map();
        await chat.save();
        console.log(`Cleared session context for chat ${chatId}`);
      }
    } catch (error) {
      console.error('Error clearing session context:', error);
    }
  }
  
  /**
   * Get conversation summary for context
   * @param chatId - Chat ID
   * @param messageLimit - Number of recent messages to include
   * @returns Conversation summary
   */
  static async getConversationSummary(chatId: string, messageLimit: number = 10): Promise<string> {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.messages || chat.messages.length === 0) {
        return 'No previous conversation.';
      }
      
      const recentMessages = chat.messages.slice(-messageLimit);
      let summary = 'Recent conversation:\n';
      
      recentMessages.forEach((msg, index) => {
        const timestamp = new Date(msg.timestamp).toLocaleTimeString();
        summary += `[${timestamp}] ${msg.sender}: ${msg.text}\n`;
      });
      
      return summary;
    } catch (error) {
      console.error('Error getting conversation summary:', error);
      return 'Error retrieving conversation history.';
    }
  }
}

export default SessionMemoryService;
