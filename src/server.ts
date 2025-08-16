import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

import logger from './utils/logger';
import { connectDatabase } from './utils/database';
import { applyMiddleware, applyErrorHandling } from './middleware';
import { initializeSocketIO } from './services/socketService';

// Import routes
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import chatRoutes from './routes/chats';

/**
 * M32 Backend Server
 * Main server file that initializes Express app, Socket.IO, and all services
 */

class Server {
  private app: express.Application;
  private httpServer: any;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000');
    this.httpServer = createServer(this.app);
  }

  /**
   * Initialize the server
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Starting M32 Backend Server...');

      // Connect to database
      await this.connectToDatabase();

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Initialize Socket.IO
      this.initializeSocketIO();

      // Setup error handling
      this.setupErrorHandling();

      // Start server
      await this.startServer();

      logger.info('M32 Backend Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize server:', error);
      process.exit(1);
    }
  }

  /**
   * Connect to MongoDB database
   */
  private async connectToDatabase(): Promise<void> {
    try {
      await connectDatabase();
      logger.info('Database connection established');
    } catch (error) {
      logger.error('Database connection failed:', error);
      logger.warn('Continuing without database connection');
      // Don't throw error - allow server to start for AI testing
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    logger.info('Setting up middleware...');
    applyMiddleware(this.app);
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    logger.info('Setting up routes...');

    // Health check route (before other routes)
    this.app.get('/', (_req, res) => {
      res.json({
        success: true,
        message: 'M32 Backend API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/profile', profileRoutes);
    this.app.use('/api/chats', chatRoutes);
    
    // Health check endpoint
    this.app.get('/api/health', async (_req, res) => {
      try {
        res.status(200).json({
          success: true,
          message: 'System health check completed',
          data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            server: 'running',
            uptime: process.uptime()
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Health check failed',
          error: 'HEALTH_CHECK_ERROR'
        });
      }
    });

    // Serve static files for Socket.IO client
    this.app.use('/socket.io', express.static(path.join(__dirname, '../node_modules/socket.io/client-dist')));

    // Serve Socket.IO test client
    this.app.get('/socket-test.html', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'socket-test.html'));
    });

    logger.info('Routes configured successfully');
  }

  /**
   * Initialize Socket.IO server
   */
  private initializeSocketIO(): void {
    logger.info('Initializing Socket.IO...');
    const io = initializeSocketIO(this.httpServer);
    
    // Store io instance for potential use in routes
    this.app.set('io', io);
    
    logger.info('Socket.IO initialized successfully');
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    logger.info('Setting up error handling...');
    applyErrorHandling(this.app);
  }

  /**
   * Start the HTTP server
   */
  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.port, (error?: Error) => {
        if (error) {
          logger.error('Failed to start server:', error);
          reject(error);
        } else {
          logger.info(`Server is running on port ${this.port}`);
          logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
          logger.info(`Health check: http://localhost:${this.port}/api/health`);
          resolve();
        }
      });
    });
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down server...');

    return new Promise((resolve) => {
      this.httpServer.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });
  }
}

/**
 * Handle uncaught exceptions and unhandled rejections
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

/**
 * Handle graceful shutdown signals
 */
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await server.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await server.shutdown();
  process.exit(0);
});

// Create and initialize server
const server = new Server();

// Start the server
if (require.main === module) {
  server.initialize().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default server;
