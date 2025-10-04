import mongoose, { Schema, Document } from 'mongoose';

export interface IWard extends Document {
  _id: string;
  code: string;
  name: string;
  name_en: string;
  full_name: string;
  full_name_en: string;
  code_name: string;
  district_code: string;
  administrative_unit_id: number;
}

const wardSchema = new Schema<IWard>(
  {
    _id: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    name_en: {
      type: String,
      required: true,
    },
    full_name: {
      type: String,
      required: true,
    },
    full_name_en: {
      type: String,
      required: true,
    },
    code_name: {
      type: String,
      required: true,
    },
    district_code: {
      type: String,
      required: true,
      ref: 'District',
    },
    administrative_unit_id: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Indexes for better performance
wardSchema.index({ code: 1 });
wardSchema.index({ district_code: 1 });
wardSchema.index({ name: 1 });

export const Ward = mongoose.model<IWard>('Ward', wardSchema);
