import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import {
  createProfile,
  getProfileByUserId,
  updateProfile,
  deleteProfile,
  getProfileStats,
  validateProfileData,
} from '../services/profileService';
import { ApiResponse, CreateProfileRequest } from '../types';

/**
 * Profile Management Routes
 * Handles profile creation, retrieval, and management endpoints
 */

const router = express.Router();

/**
 * POST /api/profile
 * Create a new profile for the authenticated user
 */
router.post(
  '/',
  authenticateToken,
  [
    // Validation middleware
    body('name')
      .notEmpty()
      .withMessage('Name is required')
      .isString()
      .withMessage('Name must be a string')
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .trim(),
    
    body('age')
      .notEmpty()
      .withMessage('Age is required')
      .isInt({ min: 13, max: 120 })
      .withMessage('Age must be between 13 and 120 years'),
    
    body('additionalInfo')
      .optional()
      .isString()
      .withMessage('Additional info must be a string')
      .isLength({ max: 500 })
      .withMessage('Additional info cannot exceed 500 characters')
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
      
      const profileData: CreateProfileRequest = {
        name: req.body.name,
        age: parseInt(req.body.age),
        additionalInfo: req.body.additionalInfo,
      };
      
      // Additional validation
      const validation = validateProfileData(profileData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: 'Profile validation failed',
          error: 'PROFILE_VALIDATION_ERROR',
          data: validation.errors,
        } as ApiResponse);
        return;
      }
      
      // Create profile
      const profile = await createProfile(req.userId, profileData);
      
      res.status(201).json({
        success: true,
        message: 'Profile created successfully',
        data: {
          id: profile._id,
          name: profile.name,
          age: profile.age,
          additionalInfo: profile.additionalInfo,
          createdAt: profile.createdAt,
        },
      } as ApiResponse);
      
    } catch (error) {
      console.error('Create profile error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          res.status(409).json({
            success: false,
            message: error.message,
            error: 'PROFILE_EXISTS',
          } as ApiResponse);
          return;
        } else if (error.message.includes('Age must be') || error.message.includes('Name must be')) {
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
        message: 'Failed to create profile',
        error: 'PROFILE_CREATION_ERROR',
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/profile
 * Get the current user's profile
 */
router.get(
  '/',
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
      
      const profile = await getProfileByUserId(req.userId);
      
      if (!profile) {
        res.status(404).json({
          success: false,
          message: 'Profile not found',
          error: 'PROFILE_NOT_FOUND',
        } as ApiResponse);
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          id: profile._id,
          name: profile.name,
          age: profile.age,
          additionalInfo: profile.additionalInfo,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      } as ApiResponse);
      
    } catch (error) {
      console.error('Get profile error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile',
        error: 'PROFILE_RETRIEVAL_ERROR',
      } as ApiResponse);
    }
  }
);

/**
 * PUT /api/profile
 * Update the current user's profile
 */
router.put(
  '/',
  authenticateToken,
  [
    // Validation middleware (all fields optional for updates)
    body('name')
      .optional()
      .isString()
      .withMessage('Name must be a string')
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .trim(),
    
    body('age')
      .optional()
      .isInt({ min: 13, max: 120 })
      .withMessage('Age must be between 13 and 120 years'),
    
    body('additionalInfo')
      .optional()
      .isString()
      .withMessage('Additional info must be a string')
      .isLength({ max: 500 })
      .withMessage('Additional info cannot exceed 500 characters')
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
      
      const updates: Partial<CreateProfileRequest> = {};
      
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.age !== undefined) updates.age = parseInt(req.body.age);
      if (req.body.additionalInfo !== undefined) updates.additionalInfo = req.body.additionalInfo;
      
      // Check if any updates were provided
      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          message: 'No updates provided',
          error: 'NO_UPDATES',
        } as ApiResponse);
        return;
      }
      
      // Update profile
      const profile = await updateProfile(req.userId, updates);
      
      if (!profile) {
        res.status(404).json({
          success: false,
          message: 'Profile not found',
          error: 'PROFILE_NOT_FOUND',
        } as ApiResponse);
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: profile._id,
          name: profile.name,
          age: profile.age,
          additionalInfo: profile.additionalInfo,
          updatedAt: profile.updatedAt,
        },
      } as ApiResponse);
      
    } catch (error) {
      console.error('Update profile error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            message: error.message,
            error: 'PROFILE_NOT_FOUND',
          } as ApiResponse);
          return;
        } else if (error.message.includes('Age must be') || error.message.includes('Name must be')) {
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
        message: 'Failed to update profile',
        error: 'PROFILE_UPDATE_ERROR',
      } as ApiResponse);
    }
  }
);

/**
 * DELETE /api/profile
 * Delete the current user's profile
 */
router.delete(
  '/',
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
      
      const deleted = await deleteProfile(req.userId);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Profile not found',
          error: 'PROFILE_NOT_FOUND',
        } as ApiResponse);
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Profile deleted successfully',
        data: {
          deleted: true,
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
      
    } catch (error) {
      console.error('Delete profile error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete profile',
        error: 'PROFILE_DELETION_ERROR',
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/profile/stats
 * Get profile statistics for the current user
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
      
      const stats = await getProfileStats(req.userId);
      
      res.status(200).json({
        success: true,
        message: 'Profile statistics retrieved successfully',
        data: stats,
      } as ApiResponse);
      
    } catch (error) {
      console.error('Get profile stats error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile statistics',
        error: 'PROFILE_STATS_ERROR',
      } as ApiResponse);
    }
  }
);

export default router;
