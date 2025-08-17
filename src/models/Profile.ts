import mongoose, { Schema, Model } from 'mongoose';
import { IProfile } from '../types';

/**
 * Profile Schema for MongoDB
 * Stores user profile information including name and age
 * Linked to User collection via userId reference
 */
const ProfileSchema: Schema<IProfile> = new Schema(
  {
    // Reference to the User document
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // One profile per user
      index: true,
    },
    
    // User's display name (can be different from Google name)
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    
    // User's age with validation (minimum 13 years as per requirements)
    age: {
      type: Number,
      required: true,
      min: [13, 'Age must be at least 13 years'],
      max: [120, 'Age cannot exceed 120 years'],
      validate: {
        validator: function(value: number) {
          return Number.isInteger(value) && value >= 13;
        },
        message: 'Age must be a valid integer and at least 13 years old',
      },
    },
    
    // Optional additional information about the user
    additionalInfo: {
      type: String,
      trim: true,
      maxlength: [500, 'Additional info cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true,
    
    // Optimize JSON output
    toJSON: {
      transform: function(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for better query performance
ProfileSchema.index({ userId: 1 });
ProfileSchema.index({ createdAt: -1 });

// Pre-save validation middleware
ProfileSchema.pre('save', function(next) {
  // Ensure age is within valid range
  if (this.age < 13) {
    const error = new Error('Age must be at least 13 years old');
    return next(error);
  }
  
  // Trim and validate name
  if (this.name) {
    this.name = this.name.trim();
    if (this.name.length < 2) {
      const error = new Error('Name must be at least 2 characters long');
      return next(error);
    }
  }
  
  next();
});

// Instance methods
ProfileSchema.methods.updateProfile = function(updates: Partial<IProfile>) {
  Object.assign(this, updates);
  return this.save();
};

// Static methods
ProfileSchema.statics.findByUserId = function(userId: string) {
  return this.findOne({ userId }).populate('userId', 'name email profilePicture');
};

ProfileSchema.statics.createProfile = function(profileData: Partial<IProfile>) {
  const profile = new this(profileData);
  return profile.save();
};

// Virtual for getting user information
ProfileSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

// Ensure virtual fields are included in JSON output
ProfileSchema.set('toJSON', { virtuals: true });

// Define interface for static methods
interface IProfileModel extends Model<IProfile> {
  findByUserId(userId: string): Promise<IProfile | null>;
  createProfile(profileData: Partial<IProfile>): Promise<IProfile>;
}

// Create and export the Profile model
const Profile = mongoose.model<IProfile, IProfileModel>('Profile', ProfileSchema);

export default Profile;
