import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IRubricCriterion {
  _id: string;
  label: string;
  description?: string;
  weight: number; // 0–1
  maxScore: number;
}

export interface IRubric extends Document {
  _id: string;
  ownerId: string; // Tutor ID
  subjectId?: string;
  name: string;
  description?: string;
  criteria: IRubricCriterion[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RubricCriterionSchema = new Schema<IRubricCriterion>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    label: {
      type: String,
      required: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    weight: {
      type: Number,
      min: 0,
      max: 1,
      default: 1,
    },
    maxScore: {
      type: Number,
      min: 1,
      max: 100,
      default: 10,
    },
  },
  { _id: false }
);

const RubricSchema = new Schema<IRubric>(
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
      ref: 'Subject',
    },
    name: {
      type: String,
      required: true,
      maxlength: 150,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    criteria: {
      type: [RubricCriterionSchema],
      validate: {
        validator: function (criteria: IRubricCriterion[]) {
          if (!criteria || !criteria.length) return false;
          const totalWeight = criteria.reduce(
            (sum, c) => sum + (c.weight || 0),
            0
          );
          return totalWeight > 0;
        },
        message: 'Rubric phải có ít nhất một tiêu chí với trọng số hợp lệ',
      },
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'rubrics',
  }
);

RubricSchema.index({ ownerId: 1, subjectId: 1 });
RubricSchema.index({ isPublic: 1 });

RubricSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const Rubric = model<IRubric>('Rubric', RubricSchema);


