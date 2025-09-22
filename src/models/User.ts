import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IUser, UserRole, UserStatus } from '../types/user.types';

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
        // ✅ REGEX ĐÚNG - Support cả email tạm và email thật
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
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
      validate: {
        validator: function(v: string) {
          // Chỉ validate nếu có giá trị
          return !v || /^(\+84|0)[3|5|7|8|9][0-9]{8}$/.test(v);
        },
        message: 'Please enter a valid Vietnamese phone number'
      }
    },
    avatar_url: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
      required: true,
      index: true, // ← THÊM index
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.PENDING_VERIFICATION,
      required: true,
      index: true, // ← THÊM index
    },
    
    // ===========================================
    // STUDENT PROFILE FIELDS
    // ===========================================
    parent_id: {
      type: String,
      ref: 'User',
      default: null,
      index: true,
    },
    date_of_birth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      default: null,
    },
    grade: {
      type: String,
      maxlength: [50, 'Grade cannot exceed 50 characters'],
      default: null,
      trim: true,
    },
    school: {
      type: String,
      maxlength: [200, 'School name cannot exceed 200 characters'],
      default: null,
      trim: true,
    },
    subjects: {
      type: [String],
      default: [],
      validate: {
        validator: function(subjects: string[]) {
          if (!Array.isArray(subjects)) return false;
          if (subjects.length > 20) return false; // Max 20 subjects
          return subjects.every(subject => 
            typeof subject === 'string' && 
            subject.trim().length > 0 && 
            subject.length <= 100
          );
        },
        message: 'Subjects must be an array of strings (max 20, each max 100 chars)'
      }
    },
    learning_goals: {
      type: String,
      maxlength: [1000, 'Learning goals cannot exceed 1000 characters'],
      default: null,
      trim: true,
    },
    preferred_schedule: {
      type: String,
      maxlength: [500, 'Preferred schedule cannot exceed 500 characters'],
      default: null,
      trim: true,
    },
    special_requirements: {
      type: String,
      maxlength: [1000, 'Special requirements cannot exceed 1000 characters'],
      default: null,
      trim: true,
    },
    password_reset_required: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  }
);

// ✅ IMPROVED INDEXES
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone_number: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ parent_id: 1, role: 1, status: 1 }); // Compound index
userSchema.index({ created_at: -1 }); // Sort index

// ===========================================
// VIRTUAL FIELDS
// ===========================================
userSchema.virtual('children', {
  ref: 'User',
  localField: '_id',
  foreignField: 'parent_id',
  match: { role: UserRole.STUDENT, status: { $ne: UserStatus.DELETED } }
});

// ===========================================
// MIDDLEWARE
// ===========================================
userSchema.pre('save', async function(next) {
  try {
    // Business rules validation
    if (this.role === UserRole.STUDENT) {
      if (!this.parent_id) {
        return next(new Error('Students must have a parent_id'));
      }
      
      // Check parent limit (max 5 students per parent)
      if (this.isNew) {
        const siblingCount = await this.model('User').countDocuments({
          parent_id: this.parent_id,
          role: UserRole.STUDENT,
          status: { $ne: UserStatus.DELETED }
        });
        
        if (siblingCount >= 5) {
          return next(new Error('Each parent can have maximum 5 students'));
        }
      }
      
      // Auto-activate students
      if (this.status === UserStatus.PENDING_VERIFICATION) {
        this.status = UserStatus.ACTIVE;
      }
    }
    
    // PARENT không được có parent_id
    if (this.role === UserRole.PARENT && this.parent_id) {
      this.parent_id = undefined;
    }
    
    next();
  } catch (error: any) {
    next(error);
  }
});

// ✅ IMPROVED JSON TRANSFORM
userSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.password_hash;
    delete ret.__v;
    
    // Format dates
    if (ret.date_of_birth) {
      ret.date_of_birth = ret.date_of_birth.toISOString().split('T')[0];
    }
    
    return ret;
  },
});

export const User = mongoose.model<IUserDocument>('User', userSchema);
