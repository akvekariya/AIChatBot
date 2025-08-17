import { Document, Types } from 'mongoose';

// Base interface for all documents
export interface BaseDocument extends Document {
  createdAt: Date;
  updatedAt: Date;
}

// User related interfaces
export interface IUser extends BaseDocument {
  googleId: string;
  email: string;
  name: string;
  profilePicture?: string;
  isActive: boolean;
  lastLogin?: Date;
}

// Profile related interfaces
export interface IProfile extends BaseDocument {
  userId: Types.ObjectId;
  name: string;
  age: number;
  additionalInfo?: string;
}

// Chat message interface
export interface IChatMessage {
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  aiModel?: string; // For AI messages - which model was used
  messageId?: string; // Unique identifier for each message
}

// Chat topics enum
export enum ChatTopic {
  HEALTH = 'health',
  EDUCATION = 'education'
}

// Chat related interfaces
export interface IChat extends BaseDocument {
  userId: Types.ObjectId;
  title?: string; // Optional chat title
  topics: ChatTopic[];
  messages: IChatMessage[];
  isActive: boolean;
  lastMessageAt?: Date;

  // Instance methods
  addMessage(message: Omit<IChatMessage, 'timestamp' | 'messageId'>): Promise<IChat>;
  getMessageHistory(limit?: number): IChatMessage[];
  deactivate(): Promise<IChat>;
}

// AI Model types
export enum AIModel {
  GPT4 = 'gpt-4',
  CLAUDE3 = 'claude-3',
  MISTRAL = 'mistral',
  COMPOSIO = 'composio'
}

// AI Response interface
export interface AIResponse {
  text: string;
  model: AIModel;
  success: boolean;
  error?: string;
  tokensUsed?: number;
  responseTime?: number;
}

// JWT Payload interface
export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Google OAuth Profile interface
export interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

// API Response interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// Socket.IO event interfaces
export interface SocketEvents {
  message: (data: { text: string; chatId: string }) => void;
  history: (data: { chatId: string }) => void;
  error: (data: { message: string; code?: string }) => void;
  join_chat: (data: { chatId: string }) => void;
  leave_chat: (data: { chatId: string }) => void;
}

// Request interfaces for API endpoints
export interface CreateProfileRequest {
  name: string;
  age: number;
  additionalInfo?: string;
}

export interface StartChatRequest {
  topics: ChatTopic[];
  title?: string;
}

export interface SendMessageRequest {
  text: string;
  chatId: string;
}

// Database connection status
export interface DatabaseStatus {
  connected: boolean;
  host?: string;
  database?: string;
  error?: string;
}

// Server health check interface
export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  database: DatabaseStatus;
  aiModels: {
    [key in AIModel]: {
      available: boolean;
      lastChecked: Date;
      error?: string;
    };
  };
}
