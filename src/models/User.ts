import mongoose, { Schema, Model } from 'mongoose';
import { IUser } from '../types';

/**
 * User Schema for MongoDB
 * Stores Google OAuth user information and session data
 */
const UserSchema: Schema<IUser> = new Schema(
  {
    // Google OAuth ID - unique identifier from Google
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    
    // User's email from Google OAuth
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    
    // User's display name from Google OAuth
    name: {
      type: String,
      required: true,
      trim: true,
    },
    
    // Optional profile picture URL from Google
    profilePicture: {
      type: String,
      default: null,
    },
    
    // Account status - for soft deletion and account management
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    
    // Track last login for analytics and security
    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true,
    
    // Optimize JSON output by removing version key and transforming _id
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
UserSchema.index({ email: 1, isActive: 1 });
UserSchema.index({ googleId: 1, isActive: 1 });
UserSchema.index({ createdAt: -1 });

// Pre-save middleware to update lastLogin
UserSchema.pre('save', function(next) {
  if (this.isNew) {
    this.lastLogin = new Date();
  }
  next();
});

// Instance methods
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

// Static methods
UserSchema.statics.findByGoogleId = function(googleId: string) {
  return this.findOne({ googleId, isActive: true });
};

UserSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

// Create and export the User model
const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);

export default User;
