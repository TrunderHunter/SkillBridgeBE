import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum PostType {
  STUDENT_REQUEST = 'student_request',
}

export enum PostStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface IPost {
  _id?: string;
  title: string;
  content: string;
  type: PostType;
  author_id: string;
  subjects: string[];
  grade_levels: string[];
  location?: string;
  is_online: boolean;
  hourly_rate?: {
    min: number;
    max: number;
  };
  availability?: string;
  requirements?: string;
  status: PostStatus;
  admin_note?: string;
  reviewed_at?: Date;
  reviewed_by?: string;
  expiry_date?: Date;
  postVector?: number[]; // AI embedding vector for semantic search
  vectorUpdatedAt?: Date; // When vector was last updated
  created_at?: Date;
  updated_at?: Date;
}

export interface IPostDocument extends IPost, Document {
  _id: string;
}

const postSchema = new Schema<IPostDocument>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    title: {
      type: String,
      required: [true, 'Tiêu đề bài đăng là bắt buộc'],
      trim: true,
      maxlength: [200, 'Tiêu đề không được vượt quá 200 ký tự'],
    },
    content: {
      type: String,
      required: [true, 'Nội dung bài đăng là bắt buộc'],
      trim: true,
      maxlength: [5000, 'Nội dung không được vượt quá 5000 ký tự'],
    },
    type: {
      type: String,
      enum: Object.values(PostType),
      default: PostType.STUDENT_REQUEST,
    },
    author_id: {
      type: String,
      required: [true, 'ID người đăng là bắt buộc'],
      ref: 'User',
    },
    subjects: {
      type: [String],
      required: [true, 'Môn học là bắt buộc'],
      validate: {
        validator: function (v: string[]) {
          return v.length > 0 && v.length <= 10;
        },
        message: 'Phải có ít nhất 1 và không quá 10 môn học',
      },
    },
    grade_levels: {
      type: [String],
      required: [true, 'Cấp độ lớp là bắt buộc'],
      validate: {
        validator: function (v: string[]) {
          return v.length > 0 && v.length <= 10;
        },
        message: 'Phải có ít nhất 1 và không quá 10 cấp độ lớp',
      },
    },
    location: {
      type: String,
      trim: true,
      maxlength: [200, 'Địa điểm không được vượt quá 200 ký tự'],
    },
    is_online: {
      type: Boolean,
      default: false,
    },
    hourly_rate: {
      min: {
        type: Number,
        min: [0, 'Học phí tối thiểu không được âm'],
      },
      max: {
        type: Number,
        min: [0, 'Học phí tối đa không được âm'],
      },
    },
    availability: {
      type: String,
      trim: true,
      maxlength: [500, 'Thời gian rảnh không được vượt quá 500 ký tự'],
    },
    requirements: {
      type: String,
      trim: true,
      maxlength: [1000, 'Yêu cầu không được vượt quá 1000 ký tự'],
    },
    status: {
      type: String,
      enum: Object.values(PostStatus),
      default: PostStatus.PENDING,
    },
    admin_note: {
      type: String,
      trim: true,
      maxlength: [1000, 'Ghi chú của admin không được vượt quá 1000 ký tự'],
    },
    reviewed_at: {
      type: Date,
    },
    reviewed_by: {
      type: String,
      ref: 'User',
    },
    expiry_date: {
      type: Date,
    },
    postVector: {
      type: [Number],
      default: undefined,
    },
    vectorUpdatedAt: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  }
);

// Indexes for better performance
postSchema.index({ author_id: 1 });
postSchema.index({ status: 1 });
postSchema.index({ subjects: 1 });
postSchema.index({ grade_levels: 1 });
postSchema.index({ created_at: -1 });

// Transform output to match API response format
postSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const Post = mongoose.model<IPostDocument>('Post', postSchema);