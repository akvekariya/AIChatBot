import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateWithGoogle } from '../services/authService';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse } from '../types';

/**
 * Authentication Routes
 * Handles Google OAuth login and JWT token management
 */

const router = express.Router();

/**
 * POST /api/auth/google
 * Authenticate user with Google ID token
 */
router.post(
  '/google',
  [
    // Validate request body
    body('idToken')
      .notEmpty()
      .withMessage('Google ID token is required')
      .isString()
      .withMessage('ID token must be a string'),
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
      
      const { idToken } = req.body;
      
      // Authenticate with Google
      const result = await authenticateWithGoogle(idToken);
      
      // Prepare response data
      const responseData = {
        user: {
          id: result.user._id,
          email: result.user.email,
          name: result.user.name,
          profilePicture: result.user.profilePicture,
          isActive: result.user.isActive,
          lastLogin: result.user.lastLogin,
        },
        token: result.token,
        isNewUser: result.isNewUser,
      };
      
      res.status(200).json({
        success: true,
        message: result.isNewUser 
          ? 'User registered and authenticated successfully' 
          : 'User authenticated successfully',
        data: responseData,
      } as ApiResponse);
      
    } catch (error) {
      console.error('Google authentication error:', error);
      
      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Authentication failed',
        error: 'GOOGLE_AUTH_ERROR',
      } as ApiResponse);
    }
  }
);



/**
 * GET /api/auth/me
 * Get current user information
 */
router.get(
  '/me',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND',
        } as ApiResponse);
        return;
      }
      
      // Return user information
      const userData = {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        profilePicture: req.user.profilePicture,
        isActive: req.user.isActive,
        lastLogin: req.user.lastLogin,
        createdAt: req.user.createdAt,
      };
      
      res.status(200).json({
        success: true,
        message: 'User information retrieved successfully',
        data: userData,
      } as ApiResponse);
      
    } catch (error) {
      console.error('Get user info error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user information',
        error: 'USER_INFO_ERROR',
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh JWT token (extend expiration)
 */
router.post(
  '/refresh',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.tokenPayload) {
        res.status(401).json({
          success: false,
          message: 'Invalid session',
          error: 'INVALID_SESSION',
        } as ApiResponse);
        return;
      }
      
      // Import here to avoid circular dependency
      const { generateToken } = await import('../utils/jwt');
      
      // Generate new token with same payload
      const newToken = generateToken({
        userId: req.tokenPayload.userId,
        email: req.tokenPayload.email,
      });
      
      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token: newToken,
          user: {
            id: req.user._id,
            email: req.user.email,
            name: req.user.name,
          },
        },
      } as ApiResponse);
      
    } catch (error) {
      console.error('Token refresh error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to refresh token',
        error: 'TOKEN_REFRESH_ERROR',
      } as ApiResponse);
    }
  }
);



export default router;
