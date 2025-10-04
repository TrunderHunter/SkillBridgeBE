import { Schema, model, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ITeachingSchedule {
  dayOfWeek: number; // 0-6 (0 = Chủ Nhật, 1 = Thứ 2, ..., 6 = Thứ 7)
  startTime: string; // Format: "HH:mm" (e.g., "08:30")
  endTime: string; // Format: "HH:mm" (e.g., "11:30")
}

export interface IAddress {
  province: string; // ID của Province
  district: string; // ID của District
  ward: string; // ID của Ward
  specificAddress: string; // Địa chỉ cụ thể (số nhà, tên đường)
}

export interface ITutorPost extends Document {
  _id: string;
  tutorId: string; // Reference to User model với role TUTOR
  title: string; // Tiêu đề bài đăng
  description: string; // Mô tả, giới thiệu

  // Thông tin dạy học
  subjects: string[]; // Reference to Subject model (có thể dạy nhiều môn)
  pricePerSession: number; // Học phí/buổi (tối thiểu 100,000 VNĐ)
  sessionDuration: number; // Thời lượng buổi học (phút) - mặc định 60 phút
  teachingMode: 'ONLINE' | 'OFFLINE' | 'BOTH'; // Hình thức dạy
  studentLevel: string[]; // Trình độ học viên nhận dạy

  // Lịch giảng dạy
  teachingSchedule: ITeachingSchedule[]; // Lịch dạy trong tuần

  // Địa chỉ (chỉ dùng khi teachingMode là OFFLINE hoặc BOTH)
  address?: IAddress;

  // Trạng thái bài đăng
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';

  // Thống kê
  viewCount: number; // Số lượt xem
  contactCount: number; // Số lượt liên hệ

  createdAt: Date;
  updatedAt: Date;
}

const TeachingScheduleSchema = new Schema<ITeachingSchedule>(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    startTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // Format HH:mm
    },
    endTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // Format HH:mm
    },
  },
  { _id: false }
);

const AddressSchema = new Schema<IAddress>(
  {
    province: {
      type: String,
      required: false, // Will be validated at TutorPost level
      ref: 'Province',
    },
    district: {
      type: String,
      required: false, // Will be validated at TutorPost level
      ref: 'District',
    },
    ward: {
      type: String,
      required: false, // Will be validated at TutorPost level
      ref: 'Ward',
    },
    specificAddress: {
      type: String,
      required: false, // Will be validated at TutorPost level
      trim: true,
      maxlength: 200,
    },
  },
  { _id: false }
);

const TutorPostSchema = new Schema<ITutorPost>(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    tutorId: {
      type: String,
      required: true,
      ref: 'User',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // Thông tin dạy học
    subjects: [
      {
        type: String,
        required: true,
        ref: 'Subject',
      },
    ],
    pricePerSession: {
      type: Number,
      required: true,
      min: 100000, // Tối thiểu 100,000 VNĐ
      max: 10000000, // Tối đa 10,000,000 VNĐ
    },
    sessionDuration: {
      type: Number,
      required: true,
      default: 60, // 60 phút
      enum: [60, 90, 120, 150, 180], // Các lựa chọn thời lượng buổi học
    },
    teachingMode: {
      type: String,
      required: true,
      enum: ['ONLINE', 'OFFLINE', 'BOTH'],
    },
    studentLevel: [
      {
        type: String,
        required: true,
        enum: [
          'TIEU_HOC', // Tiểu học
          'TRUNG_HOC_CO_SO', // Trung học cơ sở
          'TRUNG_HOC_PHO_THONG', // Trung học phổ thông
          'DAI_HOC', // Đại học
          'NGUOI_DI_LAM', // Người đi làm
          'KHAC', // Khác
        ],
      },
    ],

    // Lịch giảng dạy
    teachingSchedule: {
      type: [TeachingScheduleSchema],
      required: true,
      validate: {
        validator: function (schedules: ITeachingSchedule[]) {
          if (schedules.length === 0) return false;

          // Kiểm tra không trùng lịch trong cùng một bài đăng
          for (let i = 0; i < schedules.length; i++) {
            for (let j = i + 1; j < schedules.length; j++) {
              const schedule1 = schedules[i];
              const schedule2 = schedules[j];

              // Cùng ngày trong tuần
              if (schedule1.dayOfWeek === schedule2.dayOfWeek) {
                const start1 = schedule1.startTime;
                const end1 = schedule1.endTime;
                const start2 = schedule2.startTime;
                const end2 = schedule2.endTime;

                // Kiểm tra trùng giờ
                if (!(end1 <= start2 || end2 <= start1)) {
                  return false;
                }
              }
            }
          }

          return true;
        },
        message: 'Teaching schedules cannot overlap within the same day',
      },
    },

    // Địa chỉ (optional - chỉ cần khi dạy offline)
    address: {
      type: AddressSchema,
      required: false,
      validate: {
        validator: function (address: any) {
          // If no address provided, it's valid
          if (!address) return true;

          // If address provided, check if teachingMode requires it
          if (this.teachingMode === 'ONLINE') {
            return true; // Address not required for online teaching
          }

          // For OFFLINE or BOTH, address fields are required
          if (this.teachingMode === 'OFFLINE' || this.teachingMode === 'BOTH') {
            return (
              address.province &&
              address.district &&
              address.ward &&
              address.specificAddress
            );
          }

          return true;
        },
        message: 'Address is required for offline teaching mode',
      },
    },

    // Trạng thái bài đăng
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'INACTIVE', 'PENDING'],
      default: 'PENDING',
    },

    // Thống kê
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    contactCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: 'tutor_posts',
  }
);

// Index để tối ưu truy vấn
TutorPostSchema.index({ tutorId: 1 });
TutorPostSchema.index({ status: 1 });
TutorPostSchema.index({ subjects: 1 });
TutorPostSchema.index({ teachingMode: 1 });
TutorPostSchema.index({ studentLevel: 1 });
TutorPostSchema.index({ pricePerSession: 1 });
TutorPostSchema.index({ createdAt: -1 });
TutorPostSchema.index({ viewCount: -1 });

// Text index cho tìm kiếm
TutorPostSchema.index({
  title: 'text',
  description: 'text',
});

// Compound index cho tìm kiếm phức tạp
TutorPostSchema.index({
  status: 1,
  teachingMode: 1,
  pricePerSession: 1,
});

// Middleware để kiểm tra lịch dạy không trùng với các bài đăng khác của cùng tutor
TutorPostSchema.pre('save', async function (next) {
  if (!this.isModified('teachingSchedule') && !this.isNew) {
    return next();
  }

  try {
    // Tìm tất cả bài đăng khác của tutor này (trừ bài đăng hiện tại)
    const TutorPostModel = this.constructor as any;
    const existingPosts = await TutorPostModel.find({
      tutorId: this.tutorId,
      _id: { $ne: this._id },
      status: { $in: ['ACTIVE', 'PENDING'] },
    });

    // Kiểm tra trùng lịch với các bài đăng khác
    for (const existingPost of existingPosts) {
      for (const newSchedule of this.teachingSchedule) {
        for (const existingSchedule of existingPost.teachingSchedule) {
          // Cùng ngày trong tuần
          if (newSchedule.dayOfWeek === existingSchedule.dayOfWeek) {
            const newStart = newSchedule.startTime;
            const newEnd = newSchedule.endTime;
            const existingStart = existingSchedule.startTime;
            const existingEnd = existingSchedule.endTime;

            // Kiểm tra trùng giờ
            if (!(newEnd <= existingStart || existingEnd <= newStart)) {
              const error = new Error(
                `Teaching schedule conflicts with existing post. ` +
                  `Day ${newSchedule.dayOfWeek + 1}, ` +
                  `${newStart}-${newEnd} overlaps with ${existingStart}-${existingEnd}`
              );
              return next(error);
            }
          }
        }
      }
    }

    next();
  } catch (error) {
    next(error as any);
  }
});

// Transform output to match API response format
TutorPostSchema.set('toJSON', {
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const TutorPost = model<ITutorPost>('TutorPost', TutorPostSchema);
