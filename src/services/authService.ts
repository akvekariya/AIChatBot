import { OAuth2Client } from 'google-auth-library';
import { User } from '../models';
import { GoogleProfile, IUser, JWTPayload } from '../types';
import { generateToken } from '../utils/jwt';

/**
 * Authentication Service
 * Handles Google OAuth authentication and user management
 */

// Initialize Google OAuth2 client
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

/**
 * Verify Google ID token and extract user profile
 * @param idToken - Google ID token from frontend
 * @returns Google user profile information
 */
export const verifyGoogleToken = async (idToken: string): Promise<GoogleProfile> => {
  try {
    // Verify the token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    
    if (!payload) {
      throw new Error('Invalid Google token payload');
    }
    
    // Extract user information from Google payload
    const profile: GoogleProfile = {
      id: payload.sub,
      email: payload.email || '',
      name: payload.name || '',
      picture: payload.picture,
    };
    
    // Validate required fields
    if (!profile.id || !profile.email || !profile.name) {
      throw new Error('Incomplete Google profile information');
    }
    
    return profile;
  } catch (error) {
    console.error('Google token verification failed:', error);
    throw new Error('Invalid Google authentication token');
  }
};

/**
 * Find or create user from Google profile
 * @param googleProfile - Google user profile
 * @returns User document and JWT token
 */
export const findOrCreateUser = async (googleProfile: GoogleProfile): Promise<{
  user: IUser;
  token: string;
  isNewUser: boolean;
}> => {
  try {
    // Check if user already exists
    let user = await User.findByGoogleId(googleProfile.id);
    let isNewUser = false;
    
    if (!user) {
      // Create new user if doesn't exist
      user = new User({
        googleId: googleProfile.id,
        email: googleProfile.email.toLowerCase(),
        name: googleProfile.name,
        profilePicture: googleProfile.picture,
        isActive: true,
        lastLogin: new Date(),
      });
      
      await user.save();
      isNewUser = true;
      console.log(`New user created: ${user.email}`);
    } else {
      // Update existing user's last login and profile picture
      user.lastLogin = new Date();
      if (googleProfile.picture) {
        user.profilePicture = googleProfile.picture;
      }
      await user.save();
      console.log(`Existing user logged in: ${user.email}`);
    }
    
    // Generate JWT token
    const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user._id.toString(),
      email: user.email,
    };
    
    const token = generateToken(tokenPayload);
    
    return {
      user,
      token,
      isNewUser,
    };
  } catch (error) {
    console.error('Error finding or creating user:', error);
    throw new Error('Failed to authenticate user');
  }
};

/**
 * Authenticate user with Google ID token
 * @param idToken - Google ID token from frontend
 * @returns Authentication result with user and token
 */
export const authenticateWithGoogle = async (idToken: string): Promise<{
  user: IUser;
  token: string;
  isNewUser: boolean;
}> => {
  try {
    // Verify Google token and get profile
    const googleProfile = await verifyGoogleToken(idToken);
    
    // Find or create user in database
    const result = await findOrCreateUser(googleProfile);
    
    return result;
  } catch (error) {
    console.error('Google authentication failed:', error);
    throw error;
  }
};

/**
 * Get user by ID
 * @param userId - User ID
 * @returns User document or null
 */
export const getUserById = async (userId: string): Promise<IUser | null> => {
  try {
    const user = await User.findById(userId);
    return user;
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    return null;
  }
};

/**
 * Update user's last login timestamp
 * @param userId - User ID
 * @returns Updated user document
 */
export const updateLastLogin = async (userId: string): Promise<IUser | null> => {
  try {
    const user = await User.findById(userId);
    if (user) {
      await user.updateLastLogin();
      return user;
    }
    return null;
  } catch (error) {
    console.error('Error updating last login:', error);
    return null;
  }
};

/**
 * Deactivate user account (soft delete)
 * @param userId - User ID
 * @returns Success status
 */
export const deactivateUser = async (userId: string): Promise<boolean> => {
  try {
    const user = await User.findById(userId);
    if (user) {
      user.isActive = false;
      await user.save();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deactivating user:', error);
    return false;
  }
};

/**
 * Validate user session and return user info
 * @param userId - User ID from JWT token
 * @returns User document if valid session
 */
export const validateUserSession = async (userId: string): Promise<IUser | null> => {
  try {
    const user = await User.findById(userId);
    
    // Check if user exists and is active
    if (!user || !user.isActive) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error validating user session:', error);
    return null;
  }
};
