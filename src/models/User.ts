import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IUser, UserRole, UserStatus, Gender } from '../types/user.types';

export interface IUserDocument extends IUser, Document {
  _id: string;
}

const userSchema = new Schema<IUserDocument>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    full_name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email',
      ],
    },
    password_hash: {
      type: String,
      required: [true, 'Password is required'],
    },
    phone_number: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
      match: [
        /^(\+84|0)[3|5|7|8|9][0-9]{8}$/,
        'Please enter a valid Vietnamese phone number',
      ],
    },
    avatar_url: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      enum: Object.values(Gender),
      default: null,
    },
    date_of_birth: {
      type: Date,
      default: null,
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, 'Address cannot exceed 500 characters'],
      default: null,
    },
    // Structured address for better address management
    structured_address: {
      province_code: {
        type: String,
        ref: 'Province',
        default: null,
      },
      district_code: {
        type: String,
        ref: 'District',
        default: null,
      },
      ward_code: {
        type: String,
        ref: 'Ward',
        default: null,
      },
      detail_address: {
        type: String,
        trim: true,
        maxlength: [200, 'Detail address cannot exceed 200 characters'],
        default: null,
      },
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.PENDING_VERIFICATION,
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  }
);

// Middleware to auto-create TutorProfile when User is created with TUTOR role
userSchema.post('save', async function (doc) {
  // Only create TutorProfile for TUTOR role users
  if (doc.role === UserRole.TUTOR) {
    try {
      // Import TutorProfile here to avoid circular dependency
      const { TutorProfile } = await import('./TutorProfile');

      // Check if TutorProfile already exists
      const existingProfile = await TutorProfile.findOne({ user_id: doc._id });

      if (!existingProfile) {
        // Create new TutorProfile
        await TutorProfile.create({
          user_id: doc._id,
          headline: '',
          introduction: '',
          teaching_experience: '',
          student_levels: '',
          video_intro_link: '',
          cccd_images: [],
        });

        console.log(`TutorProfile created for user: ${doc._id}`);
      }
    } catch (error) {
      console.error(
        `Failed to create TutorProfile for user ${doc._id}:`,
        error
      );
    }
  }
});

// Indexes for better performance
// Note: email and phone_number already have unique indexes from schema definition
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });

// Transform output to match API response format
userSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.password_hash;
    return ret;
  },
});

export const User = mongoose.model<IUserDocument>('User', userSchema);
