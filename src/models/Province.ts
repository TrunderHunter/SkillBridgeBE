import mongoose, { Schema, Document } from 'mongoose';

export interface IProvince extends Document {
  _id: string;
  code: string;
  name: string;
  name_en: string;
  full_name: string;
  full_name_en: string;
  code_name: string;
  administrative_unit_id: number;
  administrative_region_id: number;
}

const provinceSchema = new Schema<IProvince>(
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
    administrative_unit_id: {
      type: Number,
      required: true,
    },
    administrative_region_id: {
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
provinceSchema.index({ code: 1 });
provinceSchema.index({ name: 1 });

export const Province = mongoose.model<IProvince>('Province', provinceSchema);
