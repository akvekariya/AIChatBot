import jwt, { SignOptions } from 'jsonwebtoken';
import { JWTPayload } from '../types';

/**
 * JWT Utility Functions
 * Handles JWT token generation, verification, and management
 */

// Get JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a JWT token for a user
 * @param payload - User information to encode in the token
 * @returns Signed JWT token
 */
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  try {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'M32Backend',
      audience: 'M32Frontend',
    } as SignOptions);
  } catch (error) {
    console.error('Error generating JWT token:', error);
    throw new Error('Failed to generate authentication token');
  }
};

/**
 * Verify and decode a JWT token
 * @param token - JWT token to verify
 * @returns Decoded token payload
 */
export const verifyToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'M32Backend',
      audience: 'M32Frontend',
    }) as JWTPayload;
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    } else {
      console.error('Error verifying JWT token:', error);
      throw new Error('Token verification failed');
    }
  }
};

/**
 * Extract token from Authorization header
 * @param authHeader - Authorization header value
 * @returns Extracted token or null
 */
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }
  
  // Check if header starts with 'Bearer '
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
  
  return null;
};

/**
 * Check if a token is expired
 * @param token - JWT token to check
 * @returns True if token is expired, false otherwise
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    if (!decoded || !decoded.exp) {
      return true;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
};

/**
 * Refresh a token (generate a new one with updated expiration)
 * @param token - Current JWT token
 * @returns New JWT token with extended expiration
 */
export const refreshToken = (token: string): string => {
  try {
    const decoded = verifyToken(token);
    
    // Create new token with same payload but new expiration
    const newPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: decoded.userId,
      email: decoded.email,
    };
    
    return generateToken(newPayload);
  } catch (error) {
    throw new Error('Cannot refresh invalid token');
  }
};

/**
 * Get token expiration date
 * @param token - JWT token
 * @returns Expiration date or null if invalid
 */
export const getTokenExpiration = (token: string): Date | null => {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    if (!decoded || !decoded.exp) {
      return null;
    }
    
    return new Date(decoded.exp * 1000);
  } catch (error) {
    return null;
  }
};
