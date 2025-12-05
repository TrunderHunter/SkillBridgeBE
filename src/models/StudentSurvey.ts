import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Student Learning Profile từ khảo sát AI
 */
export interface IStudentSurvey extends Document {
  _id: string;
  studentId: string; // Reference to User
  
  // === BASIC INFO ===
  gradeLevel: string; // "Lớp 10", "Lớp 11", "Lớp 12", "Đại học", "Người đi làm"
  subjects: string[]; // Reference to Subject IDs
  
  // === LEARNING GOALS ===
  goals: string[]; // ["improve_grades", "exam_prep", "advanced_learning", "foundation", "certification"]
  
  // === PREFERENCES ===
  teachingMode: 'ONLINE' | 'OFFLINE' | 'BOTH';
  preferredTeachingStyle: string[]; // ["traditional", "interactive", "practice", "creative"]
  currentChallenges: string[]; // pain points students are facing
  
  // === SCHEDULE & BUDGET ===
  availableTime: string[]; // ["morning", "afternoon", "evening", "weekend"]
  budgetRange: {
    min: number;
    max: number;
  };
  
  // === PERSONALITY ===
  learningPace: string; // "self_learner" | "need_guidance" | "fast_learner" | "steady_learner"
  studyFrequency: number; // sessions per week
  priorities: {
    experience: number; // 1-5 ranking
    communication: number;
    qualification: number;
    price: number;
    location: number;
  };
  
  // === AI ANALYSIS ===
  aiAnalysis?: {
    learningProfile: string; // Gemini generated summary
    recommendedTutorTypes: string[];
    studyPlanSuggestion: string;
  };
  
  // === METADATA ===
  completedAt: Date;
  isActive: boolean; // User có thể làm lại survey
  version: number; // Track survey version
  
  createdAt: Date;
  updatedAt: Date;
}

const StudentSurveySchema = new Schema<IStudentSurvey>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    studentId: {
      type: String,
      required: true,
      ref: 'User',
      // Removed unique constraint - allow multiple surveys with isActive flag
    },
    
    // Basic Info
    gradeLevel: {
      type: String,
      required: true,
      enum: [
        'Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9',
        'Lớp 10', 'Lớp 11', 'Lớp 12',
        'Đại học', 'Người đi làm'
      ],
    },
    subjects: [{
      type: String,
      required: true,
      ref: 'Subject',
    }],
    
    // Learning Goals
    goals: [{
      type: String,
      enum: [
        'improve_grades',      // Cải thiện điểm số
        'exam_prep',          // Ôn thi đại học
        'advanced_learning',  // Học thêm nâng cao
        'foundation',         // Bù kiến thức cơ bản
        'certification'       // Thi chứng chỉ (IELTS, TOEIC...)
      ],
    }],
    
    // Preferences
    teachingMode: {
      type: String,
      required: true,
      enum: ['ONLINE', 'OFFLINE', 'BOTH'],
    },
    preferredTeachingStyle: [{
      type: String,
      enum: ['traditional', 'interactive', 'practice', 'creative'],
    }],
    currentChallenges: [{
      type: String,
      enum: [
        'missing_foundation',
        'lack_consistency',
        'exam_pressure',
        'low_motivation',
        'time_management',
        'communication_gap'
      ],
      default: [],
    }],
    
    // Schedule & Budget
    availableTime: [{
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'weekend'],
    }],
    budgetRange: {
      min: {
        type: Number,
        required: true,
        min: 50000,
      },
      max: {
        type: Number,
        required: true,
        max: 1000000,
      },
    },
    
    // Personality
    learningPace: {
      type: String,
      required: true,
      enum: ['self_learner', 'need_guidance', 'fast_learner', 'steady_learner'],
    },
    studyFrequency: {
      type: Number,
      min: 1,
      max: 7,
      default: 2,
    },
    priorities: {
      experience: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
      qualification: { type: Number, min: 1, max: 5 },
      price: { type: Number, min: 1, max: 5 },
      location: { type: Number, min: 1, max: 5 },
    },
    
    // AI Analysis
    aiAnalysis: {
      learningProfile: String,
      recommendedTutorTypes: [String],
      studyPlanSuggestion: String,
    },
    
    // Metadata
    completedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    collection: 'student_surveys',
  }
);

// Indexes
StudentSurveySchema.index({ studentId: 1, isActive: 1 });
StudentSurveySchema.index({ createdAt: -1 });

// Transform output
StudentSurveySchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const StudentSurvey = model<IStudentSurvey>('StudentSurvey', StudentSurveySchema);
