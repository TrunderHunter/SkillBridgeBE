import { Schema, model, Document } from 'mongoose';

export interface ISubject extends Document {
  _id: string;
  name: string;
  description?: string;
  category: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectSchema = new Schema<ISubject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      enum: [
        'TOAN_HOC', // Toán học
        'KHOA_HOC_TU_NHIEN', // Khoa học tự nhiên (Vật lý, Hóa học, Sinh học)
        'VAN_HOC_XA_HOI', // Văn học và Xã hội (Ngữ văn, Lịch sử, Địa lý, GDCD)
        'NGOAI_NGU', // Ngoại ngữ
        'KHAC', // Khác
      ],
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'subjects',
  }
);

// Index cho tìm kiếm
SubjectSchema.index({ name: 'text', description: 'text' });
SubjectSchema.index({ category: 1 });

export const Subject = model<ISubject>('Subject', SubjectSchema);
