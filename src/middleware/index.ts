import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { loggerStream } from '../utils/logger';
import logger from '../utils/logger';

/**
 * Middleware Configuration
 * Sets up all necessary middleware for the Express application
 */

/**
 * Configure CORS middleware
 */
const configureCORS = (): express.RequestHandler => {
  const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };
  
  return cors(corsOptions);
};

/**
 * Configure rate limiting middleware
 */
const configureRateLimit = (): express.RequestHandler => {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later',
      error: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req: Request, res: Response) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        message: 'Too many requests from this IP, please try again later',
        error: 'RATE_LIMIT_EXCEEDED',
      });
    },
  });
};

/**
 * Configure security middleware
 */
const configureSecurity = (): express.RequestHandler => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
};

/**
 * Configure HTTP logging middleware
 */
const configureLogging = (): express.RequestHandler => {
  const morganFormat = process.env.NODE_ENV === 'production' 
    ? 'combined' 
    : ':method :url :status :res[content-length] - :response-time ms';
  
  return morgan(morganFormat, { stream: loggerStream });
};

/**
 * Error handling middleware
 */
const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Unhandled error:', error);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: 'INTERNAL_SERVER_ERROR',
    ...(isDevelopment && { details: error.message, stack: error.stack }),
  });
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn(`404 Not Found: ${req.method} ${req.url}`);
  
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
    error: 'ROUTE_NOT_FOUND',
  });
};

/**
 * Request logging middleware
 */
const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log request
  logger.info(`${req.method} ${req.url} - IP: ${req.ip}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
};

/**
 * Health check middleware (bypass rate limiting for health checks)
 */
const healthCheckBypass = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path === '/api/health' || req.path === '/api/status') {
    // Skip rate limiting for health checks
    return next();
  }
  next();
};

/**
 * Apply all middleware to the Express application
 * @param app - Express application instance
 */
export const applyMiddleware = (app: Application): void => {
  // Trust proxy (important for rate limiting and IP detection)
  app.set('trust proxy', 1);
  
  // Security middleware
  app.use(configureSecurity());
  
  // CORS middleware
  app.use(configureCORS());
  
  // Compression middleware
  app.use(compression());
  
  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // HTTP logging middleware
  app.use(configureLogging());
  
  // Request logging middleware (custom)
  if (process.env.NODE_ENV === 'development') {
    app.use(requestLogger);
  }
  
  // Health check bypass
  app.use(healthCheckBypass);
  
  // Rate limiting middleware
  app.use(configureRateLimit());
  
  logger.info('All middleware configured successfully');
};

/**
 * Apply error handling middleware (should be called after all routes)
 * @param app - Express application instance
 */
export const applyErrorHandling = (app: Application): void => {
  // 404 handler
  app.use(notFoundHandler);
  
  // Error handler
  app.use(errorHandler);
  
  logger.info('Error handling middleware configured');
};

// Export individual middleware for selective use
export {
  configureCORS,
  configureRateLimit,
  configureSecurity,
  configureLogging,
  errorHandler,
  notFoundHandler,
  requestLogger,
  healthCheckBypass,
};
