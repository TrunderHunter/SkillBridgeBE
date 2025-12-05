import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type ExerciseType = 'WRITING' | 'SPEAKING' | 'QUIZ' | 'FILE_UPLOAD';

export interface IExerciseTemplate extends Document {
  _id: string;
  ownerId: string; // Tutor user ID
  subjectId: string; // Subject reference
  title: string;
  description?: string;
  type: ExerciseType;
  gradeLevels: string[];
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  tags: string[];
  rubricId?: string;
  content: {
    prompt: string;
    sampleAnswer?: string;
    attachmentUrl?: string;
    resources?: string[];
  };
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ExerciseTemplateSchema = new Schema<IExerciseTemplate>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    ownerId: {
      type: String,
      required: true,
      ref: 'User',
    },
    subjectId: {
      type: String,
      required: true,
      ref: 'Subject',
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
    type: {
      type: String,
      required: true,
      enum: ['WRITING', 'SPEAKING', 'QUIZ', 'FILE_UPLOAD'],
      default: 'WRITING',
    },
    gradeLevels: {
      type: [String],
      default: [],
    },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD'],
      default: 'MEDIUM',
    },
    tags: {
      type: [String],
      default: [],
    },
    rubricId: {
      type: String,
      ref: 'Rubric',
    },
    content: {
      prompt: {
        type: String,
        required: true,
        maxlength: 4000,
      },
      sampleAnswer: {
        type: String,
        maxlength: 8000,
      },
      attachmentUrl: {
        type: String,
      },
      resources: {
        type: [String],
        default: [],
      },
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: 'exercise_templates',
  }
);

ExerciseTemplateSchema.index({ ownerId: 1, subjectId: 1 });
ExerciseTemplateSchema.index({ subjectId: 1, gradeLevels: 1, difficulty: 1 });
ExerciseTemplateSchema.index({ isPublic: 1 });

ExerciseTemplateSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const ExerciseTemplate = model<IExerciseTemplate>(
  'ExerciseTemplate',
  ExerciseTemplateSchema
);


