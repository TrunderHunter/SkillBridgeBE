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

// Interface for tutor eligibility checking
export interface ITutorEligibilityRequirement {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'pending' | 'missing';
  actionText?: string;
  actionPath?: string;
}

export interface ITutorEligibilityResponse {
  isEligible: boolean;
  requirements: ITutorEligibilityRequirement[];
}

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
      // 1. Validate tutor qualifications - CRITICAL CHECK
      await this.validateTutorQualification(tutorId);

      // 2. Additional business logic validations
      await this.validatePostData(data);

      // 3. Check for duplicate schedule conflicts
      await this.validateScheduleConflicts(tutorId, data.teachingSchedule);

      // 4. Determine initial status based on qualification completeness
      const initialStatus = await this.determineInitialPostStatus(tutorId);

      // 5. Create the post
      const tutorPost = new TutorPost({
        ...data,
        tutorId: new Types.ObjectId(tutorId),
        subjects: data.subjects.map((id) => new Types.ObjectId(id)),
        status: initialStatus,
      });

      const savedPost = await tutorPost.save();
      
      console.log(`📝 Tutor post created: ${savedPost._id} with status ${initialStatus} by tutor ${tutorId}`);
      
      return savedPost;
    } catch (error) {
      console.error(`❌ Failed to create tutor post for ${tutorId}:`, error);
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
    try {
      // 1. Kiểm tra user tồn tại và có role TUTOR
      const user = await User.findById(tutorId).select('role status');
      if (!user) {
        throw new Error('User not found');
      }

      if (user.role !== 'TUTOR') {
        throw new Error('User must have TUTOR role to create posts');
      }

      // 2. Kiểm tra TutorProfile đã được xác thực
      const tutorProfile = await TutorProfile.findOne({ 
        user_id: new Types.ObjectId(tutorId) 
      }).select('status verified_at cccd_images');
      
      if (!tutorProfile) {
        throw new Error('Tutor profile not found. Please complete your profile first.');
      }

      if (tutorProfile.status !== 'VERIFIED') {
        const statusMessages = {
          'DRAFT': 'Please complete and submit your tutor profile for verification.',
          'PENDING': 'Your tutor profile is pending verification. Please wait for admin approval.',
          'REJECTED': 'Your tutor profile was rejected. Please update and resubmit.',
          'MODIFIED_PENDING': 'Your profile modifications are pending verification.',
          'MODIFIED_AFTER_REJECTION': 'Please address the rejection feedback and resubmit.'
        };
        
        throw new Error(
          statusMessages[tutorProfile.status as keyof typeof statusMessages] || 
          'Tutor profile must be verified to create posts'
        );
      }

      // 3. Kiểm tra có ít nhất một trình độ học vấn được xác thực
      const verifiedEducations = await Education.find({
        tutorId: new Types.ObjectId(tutorProfile._id),
        status: 'VERIFIED',
      }).select('_id level school major');

      if (verifiedEducations.length === 0) {
        throw new Error(
          'At least one education qualification must be verified. Please add and verify your educational background.'
        );
      }

      // 4. Kiểm tra CCCD images (không được rỗng - bảo mật)
      if (!tutorProfile.cccd_images || tutorProfile.cccd_images.length === 0) {
        throw new Error(
          'Identity verification is required. Please upload your ID documents.'
        );
      }

      // 5. Log successful validation
      console.log(`✅ Tutor qualification validated for user ${tutorId}:`, {
        profileStatus: tutorProfile.status,
        verifiedEducations: verifiedEducations.length,
        hasIdDocuments: tutorProfile.cccd_images.length > 0,
        verifiedAt: tutorProfile.verified_at
      });

    } catch (error) {
      // Log validation failure
      console.log(`❌ Tutor qualification validation failed for user ${tutorId}:`, error);
      throw error;
    }
  }

  private async validatePostData(data: ICreateTutorPostInput): Promise<void> {
    // Validate address requirement for offline teaching
    if ((data.teachingMode === 'OFFLINE' || data.teachingMode === 'BOTH') && !data.address) {
      throw new Error('Address is required for offline or hybrid teaching mode');
    }

    // Validate schedule slots
    if (!data.teachingSchedule || data.teachingSchedule.length === 0) {
      throw new Error('At least one teaching schedule slot is required');
    }

    // Validate price range
    if (data.pricePerSession < 100000 || data.pricePerSession > 10000000) {
      throw new Error('Price per session must be between 100,000 and 10,000,000 VND');
    }

    // Validate session duration
    const validDurations = [60, 90, 120, 150, 180];
    if (!validDurations.includes(data.sessionDuration)) {
      throw new Error('Session duration must be 60, 90, 120, 150, or 180 minutes');
    }
  }

  private async validateScheduleConflicts(
    tutorId: string, 
    newSchedule: ITeachingSchedule[]
  ): Promise<void> {
    // Get existing active posts from this tutor
    const existingPosts = await TutorPost.find({
      tutorId: new Types.ObjectId(tutorId),
      status: 'ACTIVE'
    }).select('teachingSchedule');

    // Check for conflicts
    for (const existingPost of existingPosts) {
      for (const existingSlot of existingPost.teachingSchedule) {
        for (const newSlot of newSchedule) {
          if (this.isScheduleConflict(existingSlot, newSlot)) {
            throw new Error(
              `Schedule conflict detected: ${this.formatScheduleSlot(newSlot)} overlaps with existing post`
            );
          }
        }
      }
    }
  }

  private isScheduleConflict(slot1: ITeachingSchedule, slot2: ITeachingSchedule): boolean {
    if (slot1.dayOfWeek !== slot2.dayOfWeek) return false;
    
    const start1 = this.timeToMinutes(slot1.startTime);
    const end1 = this.timeToMinutes(slot1.endTime);
    const start2 = this.timeToMinutes(slot2.startTime);
    const end2 = this.timeToMinutes(slot2.endTime);

    return !(end1 <= start2 || end2 <= start1);
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private formatScheduleSlot(slot: ITeachingSchedule): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[slot.dayOfWeek]} ${slot.startTime}-${slot.endTime}`;
  }

  private async determineInitialPostStatus(tutorId: string): Promise<'ACTIVE' | 'PENDING'> {
    try {
      // If all validations pass, the post can be ACTIVE immediately
      // This assumes validateTutorQualification already passed
      return 'ACTIVE';
    } catch (error) {
      // If there are issues, set to PENDING for admin review
      return 'PENDING';
    }
  }

  // Public method for frontend to check eligibility
  async checkTutorEligibility(tutorId: string): Promise<ITutorEligibilityResponse> {
    const requirements: ITutorEligibilityRequirement[] = [];

    try {
      // Check user role
      const user = await User.findById(tutorId).select('role status');
      const userRequirement: ITutorEligibilityRequirement = {
        id: 'user-role',
        title: 'Tài khoản gia sư',
        description: 'Tài khoản phải có quyền gia sư',
        status: (user && user.role === 'TUTOR') ? 'completed' : 'missing' as 'completed' | 'pending' | 'missing'
      };
      if (!user || user.role !== 'TUTOR') {
        userRequirement.actionText = 'Đăng ký làm gia sư';
        userRequirement.actionPath = '/become-tutor';
      }
      requirements.push(userRequirement);

      // Check tutor profile
      const tutorProfile = await TutorProfile.findOne({ 
        user_id: new Types.ObjectId(tutorId) 
      }).select('status verified_at cccd_images');

      let profileStatus: 'completed' | 'pending' | 'missing' = 'missing';
      let profileActionText: string | undefined = 'Hoàn thiện hồ sơ';
      
      if (tutorProfile) {
        if (tutorProfile.status === 'VERIFIED') {
          profileStatus = 'completed';
          profileActionText = undefined;
        } else if (tutorProfile.status === 'PENDING' || tutorProfile.status === 'MODIFIED_PENDING') {
          profileStatus = 'pending';
          profileActionText = 'Chờ xác minh';
        }
      }

      const profileRequirement: ITutorEligibilityRequirement = {
        id: 'tutor-profile',
        title: 'Hồ sơ gia sư đã được xác thực',
        description: 'Thông tin cá nhân, kinh nghiệm giảng dạy và CCCD đã được xác minh',
        status: profileStatus,
        actionPath: '/tutor/profile'
      };
      if (profileActionText) {
        profileRequirement.actionText = profileActionText;
      }
      requirements.push(profileRequirement);

      // Check education
      let educationStatus: 'completed' | 'pending' | 'missing' = 'missing';
      let educationActionText: string | undefined = 'Thêm bằng cấp';

      if (tutorProfile) {
        const educations = await Education.find({
          tutorId: new Types.ObjectId(tutorProfile._id),
        }).select('status');

        const verifiedEducations = educations.filter(edu => edu.status === 'VERIFIED');
        const pendingEducations = educations.filter(edu => 
          edu.status === 'PENDING' || edu.status === 'MODIFIED_PENDING'
        );

        if (verifiedEducations.length > 0) {
          educationStatus = 'completed';
          educationActionText = undefined;
        } else if (pendingEducations.length > 0) {
          educationStatus = 'pending';
          educationActionText = 'Chờ xác minh';
        }
      }

      const educationRequirement: ITutorEligibilityRequirement = {
        id: 'education',
        title: 'Có ít nhất 1 bằng cấp được xác thực',
        description: 'Bằng cấp/chứng chỉ học vấn đã được kiểm tra và xác nhận',
        status: educationStatus,
        actionPath: '/tutor/qualifications?tab=education'
      };
      if (educationActionText) {
        educationRequirement.actionText = educationActionText;
      }
      requirements.push(educationRequirement);

      // Check ID verification
      let idStatus: 'completed' | 'pending' | 'missing' = 'missing';
      let idActionText: string | undefined = 'Upload CCCD/CMND';

      if (tutorProfile?.cccd_images && tutorProfile.cccd_images.length > 0) {
        if (tutorProfile.status === 'VERIFIED') {
          idStatus = 'completed';
          idActionText = undefined;
        } else {
          idStatus = 'pending';
          idActionText = 'Chờ xác minh';
        }
      }

      const idRequirement: ITutorEligibilityRequirement = {
        id: 'identity-verification',
        title: 'Xác thực danh tính',
        description: 'CCCD/CMND đã được xác minh để đảm bảo an toàn',
        status: idStatus,
        actionPath: '/tutor/profile'
      };
      if (idActionText) {
        idRequirement.actionText = idActionText;
      }
      requirements.push(idRequirement);

      // Determine overall eligibility
      const completedCount = requirements.filter(req => req.status === 'completed').length;
      const isEligible = completedCount === requirements.length;

      return { isEligible, requirements };

    } catch (error) {
      console.error('Error checking tutor eligibility:', error);
      // Return safe defaults on error
      const errorRequirement: ITutorEligibilityRequirement = {
        id: 'error',
        title: 'Lỗi kiểm tra điều kiện',
        description: 'Không thể kiểm tra điều kiện đăng bài. Vui lòng thử lại sau.',
        status: 'missing' as 'completed' | 'pending' | 'missing',
        actionText: 'Thử lại',
        actionPath: '/tutor/profile'
      };
      
      return {
        isEligible: false,
        requirements: requirements.length > 0 ? requirements : [errorRequirement]
      };
    }
  }
}

export const tutorPostService = new TutorPostService();
