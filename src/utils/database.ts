import mongoose from 'mongoose';
import logger from './logger';
import { DatabaseStatus } from '../types';

/**
 * Database Utility Functions
 * Handles MongoDB connection, health checks, and connection management
 */

/**
 * Connect to MongoDB database
 * @returns Promise that resolves when connected
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    // MongoDB connection options
    // const options = {
    //   maxPoolSize: 10, // Maintain up to 10 socket connections
    //   serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    //   socketTimeoutMS: 45000, // Close sockets after 45 seconds
    // };
    const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

    await mongoose.connect(mongoUri);
    
    logger.info('Successfully connected to MongoDB');
    
    // Handle connection events
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
    
    // Handle process termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};

/**
 * Disconnect from MongoDB database
 * @returns Promise that resolves when disconnected
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
    throw error;
  }
};

/**
 * Check database connection status
 * @returns Database status information
 */
export const getDatabaseStatus = (): DatabaseStatus => {
  const connection = mongoose.connection;
  
  return {
    connected: connection.readyState === 1,
    host: connection.host,
    database: connection.name,
    error: connection.readyState === 99 ? 'Connection error' : undefined,
  };
};

/**
 * Perform database health check
 * @returns Promise that resolves with health status
 */
export const performDatabaseHealthCheck = async (): Promise<{
  healthy: boolean;
  status: DatabaseStatus;
  responseTime: number;
  error?: string;
}> => {
  const startTime = Date.now();
  
  try {
    // Perform a simple database operation
    await mongoose.connection.db.admin().ping();
    
    const responseTime = Date.now() - startTime;
    const status = getDatabaseStatus();
    
    return {
      healthy: status.connected,
      status,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const status = getDatabaseStatus();
    
    return {
      healthy: false,
      status,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
};

/**
 * Get database statistics
 * @returns Database statistics
 */
export const getDatabaseStats = async (): Promise<{
  collections: number;
  documents: number;
  dataSize: number;
  indexSize: number;
  error?: string;
}> => {
  try {
    const db = mongoose.connection.db;
    const stats = await db.stats();
    
    return {
      collections: stats.collections,
      documents: stats.objects,
      dataSize: stats.dataSize,
      indexSize: stats.indexSize,
    };
  } catch (error) {
    logger.error('Error getting database stats:', error);
    return {
      collections: 0,
      documents: 0,
      dataSize: 0,
      indexSize: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Clean up old data (utility function for maintenance)
 * @param daysOld - Number of days old to consider for cleanup
 * @returns Cleanup results
 */
export const cleanupOldData = async (daysOld: number = 30): Promise<{
  deletedChats: number;
  deletedMessages: number;
  error?: string;
}> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    // Import models dynamically to avoid circular dependencies
    const { Chat } = await import('../models');
    
    // Find and delete old inactive chats
    const oldChats = await Chat.find({
      isActive: false,
      updatedAt: { $lt: cutoffDate },
    });
    
    let deletedChats = 0;
    let deletedMessages = 0;
    
    for (const chat of oldChats) {
      deletedMessages += chat.messages.length;
      await chat.deleteOne();
      deletedChats++;
    }
    
    logger.info(`Cleanup completed: ${deletedChats} chats and ${deletedMessages} messages deleted`);
    
    return {
      deletedChats,
      deletedMessages,
    };
  } catch (error) {
    logger.error('Error during cleanup:', error);
    return {
      deletedChats: 0,
      deletedMessages: 0,
      error: error instanceof Error ? error.message : 'Unknown cleanup error',
    };
  }
};
