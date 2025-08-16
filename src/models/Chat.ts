import mongoose, { Schema, Model } from 'mongoose';
import { IChat, IChatMessage, ChatTopic } from '../types';

/**
 * Chat Message Sub-Schema
 * Embedded document for individual messages within a chat
 */
const ChatMessageSchema: Schema<IChatMessage> = new Schema(
  {
    // Message content
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    
    // Message sender - either user or AI
    sender: {
      type: String,
      required: true,
      enum: ['user', 'ai'],
      index: true,
    },
    
    // Message timestamp
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    
    // AI model used (only for AI messages)
    aiModel: {
      type: String,
      enum: ['gpt-4', 'claude-3', 'mistral', 'composio'],
      required: function() {
        return this.sender === 'ai';
      },
    },
    
    // Unique identifier for each message
    messageId: {
      type: String,
      default: function() {
        return new mongoose.Types.ObjectId().toString();
      },
    },
  },
  {
    _id: true, // Enable _id for sub-documents
  }
);

/**
 * Chat Schema for MongoDB
 * Stores chat sessions with messages and metadata
 */
const ChatSchema: Schema<IChat> = new Schema(
  {
    // Reference to the User who owns this chat
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    // Optional chat title (can be auto-generated or user-defined)
    title: {
      type: String,
      trim: true,
      maxlength: [100, 'Chat title cannot exceed 100 characters'],
      default: function() {
        return `Chat ${new Date().toLocaleDateString()}`;
      },
    },
    
    // Selected topics for this chat session
    topics: {
      type: [String],
      required: true,
      enum: Object.values(ChatTopic),
      validate: {
        validator: function(topics: string[]) {
          return topics.length > 0 && topics.length <= 2;
        },
        message: 'Chat must have at least 1 and at most 2 topics',
      },
    },
    
    // Array of chat messages
    messages: {
      type: [ChatMessageSchema],
      default: [],
      validate: {
        validator: function(messages: IChatMessage[]) {
          return messages.length <= 1000; // Limit messages per chat
        },
        message: 'Chat cannot have more than 1000 messages',
      },
    },
    
    // Chat status - for soft deletion and management
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    
    // Timestamp of the last message for sorting and analytics
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true,
    
    // Optimize JSON output
    toJSON: {
      transform: function(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for better query performance
ChatSchema.index({ userId: 1, isActive: 1 });
ChatSchema.index({ userId: 1, lastMessageAt: -1 });
ChatSchema.index({ createdAt: -1 });
ChatSchema.index({ topics: 1 });

// Pre-save middleware to update lastMessageAt
ChatSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    const lastMessage = this.messages[this.messages.length - 1];
    this.lastMessageAt = lastMessage.timestamp;
  }
  next();
});

// Instance methods
ChatSchema.methods.addMessage = function(message: Omit<IChatMessage, 'timestamp' | 'messageId'>) {
  const newMessage: IChatMessage = {
    ...message,
    timestamp: new Date(),
    messageId: new mongoose.Types.ObjectId().toString(),
  };
  
  this.messages.push(newMessage);
  this.lastMessageAt = newMessage.timestamp;
  return this.save();
};

ChatSchema.methods.getMessageHistory = function(limit: number = 50) {
  return this.messages
    .slice(-limit) // Get last N messages
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

ChatSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

// Static methods
ChatSchema.statics.findUserChats = function(userId: string, limit: number = 20) {
  return this.find({ userId, isActive: true })
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .select('title topics lastMessageAt createdAt')
    .populate('userId', 'name email');
};

ChatSchema.statics.findChatWithMessages = function(chatId: string, userId: string) {
  return this.findOne({ _id: chatId, userId, isActive: true })
    .populate('userId', 'name email');
};

ChatSchema.statics.createNewChat = function(userId: string, topics: ChatTopic[], title?: string) {
  const chat = new this({
    userId,
    topics,
    title: title || `${topics.join(' & ')} Chat`,
    messages: [],
  });
  return chat.save();
};

// Virtual for message count
ChatSchema.virtual('messageCount').get(function() {
  return this.messages.length;
});

// Virtual for last message
ChatSchema.virtual('lastMessage').get(function() {
  return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
});

// Ensure virtual fields are included in JSON output
ChatSchema.set('toJSON', { virtuals: true });

// Create and export the Chat model
const Chat: Model<IChat> = mongoose.model<IChat>('Chat', ChatSchema);

export default Chat;
