import { Profile } from '../models';
import { IProfile, CreateProfileRequest } from '../types';

/**
 * Profile Service
 * Handles profile creation, retrieval, and management operations
 */

/**
 * Create a new profile for a user
 * @param userId - User ID
 * @param profileData - Profile information
 * @returns Created profile document
 */
export const createProfile = async (
  userId: string,
  profileData: CreateProfileRequest
): Promise<IProfile> => {
  try {
    // Validate age requirement (minimum 13 years)
    if (profileData.age < 13) {
      throw new Error('Age must be at least 13 years old');
    }
    
    // Validate name length
    if (!profileData.name || profileData.name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters long');
    }
    
    // Check if profile already exists for this user
    const existingProfile = await Profile.findByUserId(userId);
    if (existingProfile) {
      throw new Error('Profile already exists for this user');
    }
    
    // Create new profile
    const profile = new Profile({
      userId,
      name: profileData.name.trim(),
      age: profileData.age,
      additionalInfo: profileData.additionalInfo?.trim() || '',
    });
    
    await profile.save();
    
    console.log(`Profile created for user: ${userId}`);
    return profile;
  } catch (error) {
    console.error('Error creating profile:', error);
    throw error;
  }
};

/**
 * Get profile by user ID
 * @param userId - User ID
 * @returns Profile document or null if not found
 */
export const getProfileByUserId = async (userId: string): Promise<IProfile | null> => {
  try {
    const profile = await Profile.findByUserId(userId);
    return profile;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
};

/**
 * Update an existing profile
 * @param userId - User ID
 * @param updates - Profile updates
 * @returns Updated profile document
 */
export const updateProfile = async (
  userId: string,
  updates: Partial<CreateProfileRequest>
): Promise<IProfile | null> => {
  try {
    const profile = await Profile.findOne({ userId });
    
    if (!profile) {
      throw new Error('Profile not found');
    }
    
    // Validate updates
    if (updates.age !== undefined && updates.age < 13) {
      throw new Error('Age must be at least 13 years old');
    }
    
    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (trimmedName.length < 2) {
        throw new Error('Name must be at least 2 characters long');
      }
      updates.name = trimmedName;
    }
    
    if (updates.additionalInfo !== undefined) {
      updates.additionalInfo = updates.additionalInfo.trim();
    }
    
    // Apply updates
    Object.assign(profile, updates);
    await profile.save();
    
    console.log(`Profile updated for user: ${userId}`);
    return profile;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

/**
 * Delete a profile
 * @param userId - User ID
 * @returns Success status
 */
export const deleteProfile = async (userId: string): Promise<boolean> => {
  try {
    const result = await Profile.deleteOne({ userId });
    
    if (result.deletedCount > 0) {
      console.log(`Profile deleted for user: ${userId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error deleting profile:', error);
    return false;
  }
};

/**
 * Check if user has a complete profile
 * @param userId - User ID
 * @returns True if profile exists and is complete
 */
export const hasCompleteProfile = async (userId: string): Promise<boolean> => {
  try {
    const profile = await Profile.findOne({ userId });
    
    if (!profile) {
      return false;
    }
    
    // Check if required fields are present and valid
    return (
      profile.name &&
      profile.name.trim().length >= 2 &&
      profile.age &&
      profile.age >= 13
    );
  } catch (error) {
    console.error('Error checking profile completeness:', error);
    return false;
  }
};

/**
 * Get profile statistics
 * @param userId - User ID
 * @returns Profile statistics
 */
export const getProfileStats = async (userId: string): Promise<{
  hasProfile: boolean;
  profileCreatedAt?: Date;
  profileUpdatedAt?: Date;
  isComplete: boolean;
} | null> => {
  try {
    const profile = await Profile.findOne({ userId });
    
    if (!profile) {
      return {
        hasProfile: false,
        isComplete: false,
      };
    }
    
    const isComplete = await hasCompleteProfile(userId);
    
    return {
      hasProfile: true,
      profileCreatedAt: profile.createdAt,
      profileUpdatedAt: profile.updatedAt,
      isComplete,
    };
  } catch (error) {
    console.error('Error getting profile stats:', error);
    return null;
  }
};

/**
 * Validate profile data
 * @param profileData - Profile data to validate
 * @returns Validation result
 */
export const validateProfileData = (profileData: CreateProfileRequest): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  // Validate name
  if (!profileData.name || typeof profileData.name !== 'string') {
    errors.push('Name is required and must be a string');
  } else if (profileData.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  } else if (profileData.name.trim().length > 50) {
    errors.push('Name cannot exceed 50 characters');
  }
  
  // Validate age
  if (!profileData.age || typeof profileData.age !== 'number') {
    errors.push('Age is required and must be a number');
  } else if (!Number.isInteger(profileData.age)) {
    errors.push('Age must be a whole number');
  } else if (profileData.age < 13) {
    errors.push('Age must be at least 13 years old');
  } else if (profileData.age > 120) {
    errors.push('Age cannot exceed 120 years');
  }
  
  // Validate additional info (optional)
  if (profileData.additionalInfo && typeof profileData.additionalInfo !== 'string') {
    errors.push('Additional info must be a string');
  } else if (profileData.additionalInfo && profileData.additionalInfo.length > 500) {
    errors.push('Additional info cannot exceed 500 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};
