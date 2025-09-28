import mongoose, { Schema, Document } from 'mongoose';

export interface IDistrict extends Document {
  _id: string;
  code: string;
  name: string;
  name_en: string;
  full_name: string;
  full_name_en: string;
  code_name: string;
  province_code: string;
  administrative_unit_id: number;
}

const districtSchema = new Schema<IDistrict>(
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
    province_code: {
      type: String,
      required: true,
      ref: 'Province',
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
districtSchema.index({ code: 1 });
districtSchema.index({ province_code: 1 });
districtSchema.index({ name: 1 });

export const District = mongoose.model<IDistrict>('District', districtSchema);
