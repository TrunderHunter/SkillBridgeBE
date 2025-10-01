import {
  TutorPost,
  ITutorPost,
  ITeachingSchedule,
  IAddress,
} from '../../models/TutorPost';
import { TutorProfile } from '../../models/TutorProfile';
import { User } from '../../models/User';
import { Education } from '../../models/Education';
import { Types } from 'mongoose';

export interface ICreateTutorPostInput {
  title: string;
  description: string;
  experience: string;
  videoIntroUrl?: string;
  subjects: string[]; // Subject IDs
  pricePerSession: number;
  sessionDuration: number;
  teachingMode: 'ONLINE' | 'OFFLINE' | 'BOTH';
  studentLevel: string[];
  teachingSchedule: ITeachingSchedule[];
  address?: IAddress;
}

export interface IUpdateTutorPostInput {
  title?: string;
  description?: string;
  experience?: string;
  videoIntroUrl?: string;
  subjects?: string[];
  pricePerSession?: number;
  sessionDuration?: number;
  teachingMode?: 'ONLINE' | 'OFFLINE' | 'BOTH';
  studentLevel?: string[];
  teachingSchedule?: ITeachingSchedule[];
  address?: IAddress;
}

export interface ITutorPostQuery {
  subjects?: string[];
  teachingMode?: 'ONLINE' | 'OFFLINE' | 'BOTH';
  studentLevel?: string[];
  priceMin?: number;
  priceMax?: number;
  province?: string;
  district?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'pricePerSession' | 'viewCount';
  sortOrder?: 'asc' | 'desc';
}

export class TutorPostService {
  async createTutorPost(
    tutorId: string,
    data: ICreateTutorPostInput
  ): Promise<ITutorPost> {
    try {
      // Kiểm tra tutor có được xác thực không
      await this.validateTutorQualification(tutorId);

      const tutorPost = new TutorPost({
        ...data,
        tutorId: new Types.ObjectId(tutorId),
        subjects: data.subjects.map((id) => new Types.ObjectId(id)),
      });

      return await tutorPost.save();
    } catch (error) {
      throw error;
    }
  }

  async updateTutorPost(
    postId: string,
    tutorId: string,
    data: IUpdateTutorPostInput
  ): Promise<ITutorPost | null> {
    try {
      if (!Types.ObjectId.isValid(postId)) {
        throw new Error('Invalid post ID');
      }

      // Kiểm tra quyền sở hữu bài đăng
      const existingPost = await TutorPost.findById(postId);
      if (!existingPost) {
        throw new Error('Post not found');
      }

      if (existingPost.tutorId.toString() !== tutorId) {
        throw new Error('Unauthorized to update this post');
      }

      const updateData: any = { ...data };
      if (data.subjects) {
        updateData.subjects = data.subjects.map((id) => new Types.ObjectId(id));
      }

      const tutorPost = await TutorPost.findByIdAndUpdate(
        postId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('subjects tutorId', 'name email gender');

      return tutorPost;
    } catch (error) {
      throw error;
    }
  }

  async getTutorPosts(tutorId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const posts = await TutorPost.find({ tutorId })
        .populate('subjects', 'name category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await TutorPost.countDocuments({ tutorId });

      return {
        posts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async searchTutorPosts(query: ITutorPostQuery) {
    try {
      const {
        subjects,
        teachingMode,
        studentLevel,
        priceMin,
        priceMax,
        province,
        district,
        search,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = query;

      // Build filter
      const filter: any = { status: 'ACTIVE' };

      if (subjects && subjects.length > 0) {
        filter.subjects = { $in: subjects.map((id) => new Types.ObjectId(id)) };
      }

      if (teachingMode) {
        filter.teachingMode = { $in: [teachingMode, 'BOTH'] };
      }

      if (studentLevel && studentLevel.length > 0) {
        filter.studentLevel = { $in: studentLevel };
      }

      if (priceMin !== undefined || priceMax !== undefined) {
        filter.pricePerSession = {};
        if (priceMin !== undefined) filter.pricePerSession.$gte = priceMin;
        if (priceMax !== undefined) filter.pricePerSession.$lte = priceMax;
      }

      if (province) {
        filter['address.province'] = province;
      }

      if (district) {
        filter['address.district'] = district;
      }

      if (search) {
        filter.$text = { $search: search };
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Build sort
      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      const posts = await TutorPost.find(filter)
        .populate('subjects', 'name category')
        .populate('tutorId', 'name email gender')
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const total = await TutorPost.countDocuments(filter);

      return {
        posts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        filters: query,
      };
    } catch (error) {
      throw error;
    }
  }

  async getTutorPostById(postId: string): Promise<ITutorPost | null> {
    try {
      if (!Types.ObjectId.isValid(postId)) {
        throw new Error('Invalid post ID');
      }

      const post = await TutorPost.findById(postId)
        .populate('subjects', 'name category description')
        .populate('tutorId', 'name email gender')
        .populate('address.province address.district address.ward', 'name');

      if (post) {
        // Increment view count
        await TutorPost.findByIdAndUpdate(postId, { $inc: { viewCount: 1 } });
      }

      return post;
    } catch (error) {
      throw error;
    }
  }

  async activatePost(
    postId: string,
    tutorId: string
  ): Promise<ITutorPost | null> {
    try {
      const post = await TutorPost.findOneAndUpdate(
        { _id: postId, tutorId },
        { $set: { status: 'ACTIVE' } },
        { new: true }
      );

      return post;
    } catch (error) {
      throw error;
    }
  }

  async deactivatePost(
    postId: string,
    tutorId: string
  ): Promise<ITutorPost | null> {
    try {
      const post = await TutorPost.findOneAndUpdate(
        { _id: postId, tutorId },
        { $set: { status: 'INACTIVE' } },
        { new: true }
      );

      return post;
    } catch (error) {
      throw error;
    }
  }

  async deleteTutorPost(postId: string, tutorId: string): Promise<boolean> {
    try {
      const result = await TutorPost.findOneAndDelete({
        _id: postId,
        tutorId,
      });

      return result !== null;
    } catch (error) {
      throw error;
    }
  }

  async incrementContactCount(postId: string): Promise<void> {
    try {
      await TutorPost.findByIdAndUpdate(postId, { $inc: { contactCount: 1 } });
    } catch (error) {
      throw error;
    }
  }

  private async validateTutorQualification(tutorId: string): Promise<void> {
    // Kiểm tra user có role TUTOR
    const user = await User.findById(tutorId);
    if (!user || user.role !== 'TUTOR') {
      throw new Error('User must be a tutor to create posts');
    }

    // Kiểm tra TutorProfile đã được xác thực
    const tutorProfile = await TutorProfile.findOne({ user_id: tutorId });
    if (!tutorProfile) {
      throw new Error('Tutor profile not found');
    }

    if (tutorProfile.status !== 'VERIFIED') {
      throw new Error('Personal information must be verified to create posts');
    }

    // Kiểm tra có ít nhất một trình độ học vấn được xác thực
    const verifiedEducations = await Education.find({
      tutorId: tutorProfile._id,
      status: 'VERIFIED',
    });

    if (verifiedEducations.length === 0) {
      throw new Error(
        'At least one education qualification must be verified to create posts'
      );
    }
  }
}

export const tutorPostService = new TutorPostService();
