import mongoose from 'mongoose';
import {
  TutorPost,
  ITutorPost,
  ITeachingSchedule,
  IAddress,
} from '../../models/TutorPost';
import { TutorProfile } from '../../models/TutorProfile';
import { User } from '../../models/User';
import { Education } from '../../models/Education';
import { Certificate } from '../../models/Certificate';
import { Achievement } from '../../models/Achievement';
import { Subject } from '../../models/Subject';
import { Province, District, Ward } from '../../models';
import { createVietnameseSearchRegex } from '../../utils/vietnameseSearch';

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
  sortBy?: 'createdAt' | 'pricePerSession' | 'viewCount' | 'rating';
  sortOrder?: 'asc' | 'desc';
  minRating?: number;
  minReviews?: number;
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
      try {
        console.log('Creating TutorPost with data:', {
          ...data,
          tutorId: tutorId,
          subjects: data.subjects,
          status: initialStatus,
        });

        const tutorPost = new TutorPost({
          ...data,
          tutorId: tutorId,
          subjects: data.subjects,
          status: initialStatus,
        });

        const savedPost = await tutorPost.save();

        console.log(
          `📝 Tutor post created: ${savedPost._id} with status ${initialStatus} by tutor ${tutorId}`
        );

        return savedPost;
      } catch (createError) {
        console.error('Error creating TutorPost:', createError);
        throw createError;
      }
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
      // UUID validation - basic format check
      if (!postId || typeof postId !== 'string' || postId.length !== 36) {
        throw new Error('Invalid post ID');
      }

      // Kiểm tra quyền sở hữu bài đăng
      const existingPost = await TutorPost.findById(postId);
      if (!existingPost) {
        throw new Error('Post not found');
      }

      if (existingPost.tutorId !== tutorId) {
        throw new Error('Unauthorized to update this post');
      }

      const updateData: any = { ...data };
      // subjects are now strings, no conversion needed

      // Check for schedule conflicts if teachingSchedule is being updated
      if (data.teachingSchedule) {
        await this.validateScheduleConflicts(
          tutorId,
          data.teachingSchedule,
          postId
        );
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

  // ✅ Enhanced search method - SIMPLIFIED AND FIXED
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
        limit = 12,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        minRating,
        minReviews,
      } = query;

      console.log('🔍 Searching tutor posts with query:', query);

      // Xây dựng bộ lọc (filter)
      const filter: any = {
        status: 'ACTIVE',
      };

      // Chỉ tìm các bài đăng từ gia sư đã được xác minh
      const verifiedTutorIds = await this.getVerifiedTutorIds();
      let tutorIdFilter = [...verifiedTutorIds];

      if (minRating !== undefined || minReviews !== undefined) {
        const ratingQuery: any = { user_id: { $in: verifiedTutorIds } };
        if (minRating !== undefined) {
          ratingQuery.ratingAverage = { $gte: minRating };
        }
        if (minReviews !== undefined) {
          ratingQuery.ratingCount = { $gte: minReviews };
        }

        const qualifiedTutors = await TutorProfile.find(ratingQuery)
          .select('user_id')
          .lean();

        tutorIdFilter = qualifiedTutors.map((doc) => doc.user_id);
      }

      if (!tutorIdFilter.length) {
        return {
          posts: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            hasNext: false,
            hasPrev: page > 1,
          },
        };
      }

      filter.tutorId = { $in: tutorIdFilter };

      // Áp dụng các điều kiện lọc từ query
      if (subjects && subjects.length > 0) {
        filter.subjects = { $in: subjects };
      }
      if (teachingMode) {
        if (teachingMode === 'BOTH') {
          filter.teachingMode = { $in: ['ONLINE', 'OFFLINE', 'BOTH'] };
        } else {
          filter.teachingMode = { $in: [teachingMode, 'BOTH'] };
        }
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

      // Xử lý tìm kiếm bằng từ khóa (text search) - hỗ trợ tìm kiếm không dấu
      if (search && search.trim()) {
        const searchRegex = createVietnameseSearchRegex(search.trim());
        // Tìm ID của các môn học và gia sư khớp với từ khóa
        const matchingSubjects = await Subject.find({ name: searchRegex })
          .select('_id')
          .lean();
        const matchingTutors = await User.find({ full_name: searchRegex })
          .select('_id')
          .lean();

        filter.$or = [
          { title: searchRegex },
          { description: searchRegex },
          { subjects: { $in: matchingSubjects.map((s) => s._id) } },
          { tutorId: { $in: matchingTutors.map((t) => t._id) } },
        ];
      }

      console.log('📋 Built filter:', JSON.stringify(filter, null, 2));

      const skip = (page - 1) * limit;
      const wantsRatingSort = sortBy === 'rating';

      if (wantsRatingSort) {
        const ratingPipeline: any[] = [
          { $match: filter },
          {
            $lookup: {
              from: 'tutorprofiles',
              localField: 'tutorId',
              foreignField: 'user_id',
              as: 'ratingProfile',
              pipeline: [
                {
                  $project: {
                    ratingAverage: 1,
                    ratingCount: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              ratingAverage: {
                $ifNull: [{ $arrayElemAt: ['$ratingProfile.ratingAverage', 0] }, 0],
              },
              ratingCount: {
                $ifNull: [{ $arrayElemAt: ['$ratingProfile.ratingCount', 0] }, 0],
              },
            },
          },
          {
            $addFields: {
              ratingScore: {
                $add: [
                  { $multiply: ['$ratingAverage', 100] },
                  { $min: ['$ratingCount', 50] },
                ],
              },
            },
          },
        ];

        const sortStage = {
          $sort: {
            ratingScore: sortOrder === 'asc' ? 1 : -1,
            createdAt: -1,
          },
        };

        const [idDocs, totalResult] = await Promise.all([
          TutorPost.aggregate([
            ...ratingPipeline,
            sortStage,
            { $skip: skip },
            { $limit: limit },
            { $project: { _id: 1 } },
          ]),
          TutorPost.aggregate([
            ...ratingPipeline,
            { $count: 'total' },
          ]),
        ]);

        const orderedIds = idDocs.map((doc) => doc._id.toString());

        const posts = await TutorPost.find({ _id: { $in: orderedIds } })
          .populate('subjects', 'name category')
          .populate({
            path: 'tutorId',
            select:
              'full_name avatar_url date_of_birth gender profile structured_address',
          })
          .lean();

        const postMap = new Map(
          posts.map((post) => [post._id.toString(), post])
        );

        const orderedPosts = orderedIds
          .map((id) => postMap.get(id))
          .filter((post): post is any => Boolean(post));

        const enhancedPosts = await Promise.all(
          orderedPosts.map((post) => this.enhanceTutorInfo(post))
        );

        const totalItems = totalResult[0]?.total || 0;
        const totalPages = Math.ceil(totalItems / limit);

        return {
          posts: enhancedPosts,
          pagination: {
            currentPage: page,
            totalPages,
            totalItems,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        };
      }

      const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      // Thực hiện 2 query song song để lấy dữ liệu và tổng số lượng
      const [posts, totalItems] = await Promise.all([
        TutorPost.find(filter)
          .populate('subjects', 'name category') // <-- POPULATE ĐÚNG CHO MÔN HỌC
          .populate({
            path: 'tutorId',
            select:
              'full_name avatar_url date_of_birth gender profile structured_address',
            // Không dùng populate lồng nhau ở đây nữa để tránh lỗi
          })
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        TutorPost.countDocuments(filter),
      ]);

      // Sau khi có kết quả, chúng ta sẽ bổ sung thông tin profile cho từng gia sư
      const enhancedPosts = await Promise.all(
        posts.map((post) => this.enhanceTutorInfo(post))
      );

      const totalPages = Math.ceil(totalItems / limit);

      return {
        posts: enhancedPosts,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('❌ Search tutor posts error:', error);
      throw error;
    }
  }

  // ✅ Fix getFilterOptions - Remove status checking for subjects
  async getFilterOptions() {
    try {
      console.log('🔧 Getting filter options...');

      const [subjects, provinces, priceStats] = await Promise.all([
        // ✅ Get all subjects without status filter
        Subject.find({})
          .select('_id name category')
          .sort({ category: 1, name: 1 })
          .lean(),

        // Get provinces that have active tutor posts
        this.getProvincesWithTutors(),

        // Get price range statistics
        TutorPost.aggregate([
          { $match: { status: 'ACTIVE' } },
          {
            $group: {
              _id: null,
              minPrice: { $min: '$pricePerSession' },
              maxPrice: { $max: '$pricePerSession' },
              avgPrice: { $avg: '$pricePerSession' },
            },
          },
        ]),
      ]);

      // Group subjects by category
      const subjectsByCategory = subjects.reduce((acc: any, subject) => {
        const category = subject.category || 'Khác';
        if (!acc[category]) acc[category] = [];
        acc[category].push(subject);
        return acc;
      }, {});

      const result = {
        subjects: {
          all: subjects,
          byCategory: subjectsByCategory,
        },
        studentLevels: [
          { value: 'TIEU_HOC', label: 'Tiểu học' },
          { value: 'TRUNG_HOC_CO_SO', label: 'THCS' },
          { value: 'TRUNG_HOC_PHO_THONG', label: 'THPT' },
          { value: 'DAI_HOC', label: 'Đại học' },
          { value: 'NGUOI_DI_LAM', label: 'Người đi làm' },
          { value: 'KHAC', label: 'Khác' },
        ],
        teachingModes: [
          { value: 'ONLINE', label: 'Trực tuyến', icon: '💻' },
          { value: 'OFFLINE', label: 'Trực tiếp', icon: '🏠' },
          { value: 'BOTH', label: 'Cả hai', icon: '🔄' },
        ],
        provinces,
        priceRange: priceStats[0] || {
          minPrice: 100000,
          maxPrice: 2000000,
          avgPrice: 500000,
        },
        sortOptions: [
          { value: 'createdAt', label: 'Mới nhất', order: 'desc' },
          { value: 'pricePerSession', label: 'Giá thấp nhất', order: 'asc' },
          { value: 'pricePerSession', label: 'Giá cao nhất', order: 'desc' },
          { value: 'viewCount', label: 'Xem nhiều nhất', order: 'desc' },
          { value: 'contactCount', label: 'Liên hệ nhiều nhất', order: 'desc' },
        ],
      };

      console.log('✅ Filter options loaded successfully');
      return result;
    } catch (error) {
      console.error('❌ Get filter options error:', error);
      throw error;
    }
  }

  // ✅ Get districts by province code
  async getDistrictsByProvince(provinceCode: string) {
    try {
      const districts = await District.find({ province_code: provinceCode })
        .select('code name')
        .sort({ name: 1 })
        .lean();

      return districts;
    } catch (error) {
      console.error('Get districts error:', error);
      throw error;
    }
  }

  // ✅ Get wards by district code
  async getWardsByDistrict(districtCode: string) {
    try {
      const wards = await Ward.find({ district_code: districtCode })
        .select('code name')
        .sort({ name: 1 })
        .lean();

      return wards;
    } catch (error) {
      console.error('Get wards error:', error);
      throw error;
    }
  }

  async getTutorPostById(
    postId: string,
    shouldIncrementView?: boolean,
    userId?: string
  ): Promise<ITutorPost | null> {
    try {
      const post = await TutorPost.findById(postId)
        .populate('subjects', 'name category')
        .populate(
          'tutorId',
          'full_name email gender date_of_birth avatar_url structured_address'
        )
        .lean();

      if (post) {
        // Only increment view count if explicitly requested and user is not the tutor
        // Check both populated and non-populated cases
        const tutorId =
          typeof post.tutorId === 'object'
            ? (post.tutorId as any)._id
            : post.tutorId;
        if (shouldIncrementView && userId && tutorId !== userId) {
          await TutorPost.findByIdAndUpdate(postId, { $inc: { viewCount: 1 } });
        }

        // Enhance tutor information with additional data
        const enhancedPost = await this.enhanceTutorInfo(post);
        return enhancedPost;
      }

      // Increment view count
      await TutorPost.findByIdAndUpdate(postId, { $inc: { viewCount: 1 } });

      // Enhance with additional information
      const enhancedPost = await this.enhanceTutorInfo(post);

      return enhancedPost;
    } catch (error) {
      console.error('Get tutor post by ID error:', error);
      throw error;
    }
  }

  // ✅ Activate post
  async activatePost(
    postId: string,
    tutorId: string
  ): Promise<ITutorPost | null> {
    try {
      const post = await TutorPost.findOneAndUpdate(
        { _id: postId, tutorId: tutorId },
        { status: 'ACTIVE' },
        { new: true }
      ).populate('subjects', 'name category');

      return post;
    } catch (error) {
      console.error('Activate post error:', error);
      throw error;
    }
  }

  // ✅ Deactivate post
  async deactivatePost(
    postId: string,
    tutorId: string
  ): Promise<ITutorPost | null> {
    try {
      const post = await TutorPost.findOneAndUpdate(
        { _id: postId, tutorId: tutorId },
        { status: 'INACTIVE' },
        { new: true }
      ).populate('subjects', 'name category');

      return post;
    } catch (error) {
      console.error('Deactivate post error:', error);
      throw error;
    }
  }

  // ✅ Delete tutor post
  async deleteTutorPost(postId: string, tutorId: string): Promise<boolean> {
    try {
      const result = await TutorPost.findOneAndDelete({
        _id: postId,
        tutorId: tutorId,
      });

      return !!result;
    } catch (error) {
      console.error('Delete tutor post error:', error);
      throw error;
    }
  }

  // ✅ Increment contact count
  async incrementContactCount(postId: string): Promise<void> {
    try {
      await TutorPost.findByIdAndUpdate(postId, { $inc: { contactCount: 1 } });
    } catch (error) {
      console.error('Increment contact count error:', error);
      throw error;
    }
  }

  // Helper methods
  private async getVerifiedTutorIds(): Promise<string[]> {
    try {
      const verifiedProfiles = await TutorProfile.find({
        status: 'VERIFIED',
      }).select('user_id');

      return verifiedProfiles.map((profile) => profile.user_id);
    } catch (error) {
      console.error('Error getting verified tutor IDs:', error);
      return [];
    }
  }

  private async getProvincesWithTutors() {
    try {
      // Get unique province codes from active tutor posts
      const provinceCodes = await TutorPost.distinct('address.province', {
        status: 'ACTIVE',
      });

      // Get province details
      const provinces = await Province.find({
        code: { $in: provinceCodes },
      })
        .select('code name')
        .sort({ name: 1 })
        .lean();

      return provinces;
    } catch (error) {
      console.error('Error getting provinces with tutors:', error);
      return [];
    }
  }

  /**
   * NEW: Simplified validation - only checks if TutorProfile is VERIFIED
   * Qualifications are now optional
   */
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

      // 2. Kiểm tra TutorProfile đã được xác thực (ĐỦ ĐIỀU KIỆN)
      const tutorProfile = await TutorProfile.findOne({
        user_id: tutorId,
      }).select('status verified_at');

      if (!tutorProfile) {
        throw new Error(
          'Tutor profile not found. Please complete your profile first.'
        );
      }

      if (tutorProfile.status !== 'VERIFIED') {
        const statusMessages = {
          DRAFT:
            'Please complete and submit your tutor profile for verification.',
          PENDING:
            'Your tutor profile is pending verification. Please wait for admin approval.',
          REJECTED:
            'Your tutor profile was rejected. Please update and resubmit.',
          MODIFIED_PENDING:
            'Your profile modifications are pending verification.',
          MODIFIED_AFTER_REJECTION:
            'Please address the rejection feedback and resubmit.',
        };

        throw new Error(
          statusMessages[tutorProfile.status as keyof typeof statusMessages] ||
          'Tutor profile must be verified to create posts'
        );
      }

      // Log successful validation
      console.log(`✅ Tutor qualification validated for user ${tutorId}:`, {
        profileStatus: tutorProfile.status,
        verifiedAt: tutorProfile.verified_at,
      });
    } catch (error) {
      // Log validation failure
      console.log(
        `❌ Tutor qualification validation failed for user ${tutorId}:`,
        error
      );
      throw error;
    }
  }

  private async validatePostData(data: ICreateTutorPostInput): Promise<void> {
    // Validate address requirement for offline teaching
    if (
      (data.teachingMode === 'OFFLINE' || data.teachingMode === 'BOTH') &&
      !data.address
    ) {
      throw new Error(
        'Address is required for offline or hybrid teaching mode'
      );
    }

    // Validate schedule slots
    if (!data.teachingSchedule || data.teachingSchedule.length === 0) {
      throw new Error('At least one teaching schedule slot is required');
    }

    // Validate price range
    if (data.pricePerSession < 100000 || data.pricePerSession > 10000000) {
      throw new Error(
        'Price per session must be between 100,000 and 10,000,000 VND'
      );
    }

    // Validate session duration
    const validDurations = [60, 90, 120, 150, 180];
    if (!validDurations.includes(data.sessionDuration)) {
      throw new Error(
        'Session duration must be 60, 90, 120, 150, or 180 minutes'
      );
    }
  }

  private async validateScheduleConflicts(
    tutorId: string,
    newSchedule: ITeachingSchedule[],
    excludePostId?: string
  ): Promise<void> {
    // Get existing active posts from this tutor, excluding the current post if updating
    const query: any = {
      tutorId: tutorId,
      status: 'ACTIVE',
    };

    if (excludePostId) {
      query._id = { $ne: excludePostId };
    }

    const existingPosts =
      await TutorPost.find(query).select('teachingSchedule');

    // Check for conflicts
    for (const existingPost of existingPosts) {
      for (const existingSlot of existingPost.teachingSchedule) {
        for (const newSlot of newSchedule) {
          if (this.isScheduleConflict(existingSlot, newSlot)) {
            const conflictMessage = `${this.formatScheduleSlotVietnamese(newSlot)} trùng với bài đăng hiện có`;
            const error = new Error(conflictMessage);
            (error as any).isScheduleConflict = true;
            throw error;
          }
        }
      }
    }
  }

  private isScheduleConflict(
    slot1: ITeachingSchedule,
    slot2: ITeachingSchedule
  ): boolean {
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
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return `${days[slot.dayOfWeek]} ${slot.startTime}-${slot.endTime}`;
  }

  private formatScheduleSlotVietnamese(slot: ITeachingSchedule): string {
    const days = [
      'Chủ nhật',
      'Thứ hai',
      'Thứ ba',
      'Thứ tư',
      'Thứ năm',
      'Thứ sáu',
      'Thứ bảy',
    ];
    return `${days[slot.dayOfWeek]} ${slot.startTime}-${slot.endTime}`;
  }

  private async determineInitialPostStatus(
    tutorId: string
  ): Promise<'ACTIVE' | 'PENDING'> {
    try {
      // If all validations pass, the post can be ACTIVE immediately
      // This assumes validateTutorQualification already passed
      return 'ACTIVE';
    } catch (error) {
      // If there are issues, set to PENDING for admin review
      return 'PENDING';
    }
  }

  /**
   * NEW: Simplified eligibility check
   * Only requires TutorProfile to be VERIFIED
   * Education/Qualifications are now optional
   */
  async checkTutorEligibility(
    tutorId: string
  ): Promise<ITutorEligibilityResponse> {
    const requirements: ITutorEligibilityRequirement[] = [];

    try {
      // Check user role
      const user = await User.findById(tutorId).select('role status');
      const userRequirement: ITutorEligibilityRequirement = {
        id: 'user-role',
        title: 'Tài khoản gia sư',
        description: 'Tài khoản phải có quyền gia sư',
        status:
          user && user.role === 'TUTOR'
            ? 'completed'
            : ('missing' as 'completed' | 'pending' | 'missing'),
      };
      if (!user || user.role !== 'TUTOR') {
        userRequirement.actionText = 'Đăng ký làm gia sư';
        userRequirement.actionPath = '/become-tutor';
      }
      requirements.push(userRequirement);

      // Check tutor profile (ONLY REQUIRED CONDITION)
      const tutorProfile = await TutorProfile.findOne({
        user_id: tutorId,
      }).select('status verified_at');

      let profileStatus: 'completed' | 'pending' | 'missing' = 'missing';
      let profileActionText: string | undefined = 'Hoàn thiện hồ sơ';

      if (tutorProfile) {
        if (tutorProfile.status === 'VERIFIED') {
          profileStatus = 'completed';
          profileActionText = undefined;
        } else if (
          tutorProfile.status === 'PENDING' ||
          tutorProfile.status === 'MODIFIED_PENDING'
        ) {
          profileStatus = 'pending';
          profileActionText = 'Đang chờ admin xác thực';
        } else if (tutorProfile.status === 'REJECTED') {
          profileStatus = 'missing';
          profileActionText = 'Hồ sơ bị từ chối - Cần chỉnh sửa';
        } else if (tutorProfile.status === 'DRAFT') {
          profileStatus = 'missing';
          profileActionText = 'Hoàn thiện và gửi xác thực';
        }
      }

      const profileRequirement: ITutorEligibilityRequirement = {
        id: 'tutor-profile',
        title: 'Hồ sơ gia sư đã được xác thực',
        description:
          'Hồ sơ cá nhân, kinh nghiệm giảng dạy và CCCD đã được admin xác minh',
        status: profileStatus,
        actionPath: '/tutor/profile/complete',
      };
      if (profileActionText) {
        profileRequirement.actionText = profileActionText;
      }
      requirements.push(profileRequirement);

      // Determine overall eligibility (chỉ cần 2 điều kiện: role + profile verified)
      const completedCount = requirements.filter(
        (req) => req.status === 'completed'
      ).length;
      const isEligible = completedCount === requirements.length;

      return { isEligible, requirements };
    } catch (error) {
      console.error('Error checking tutor eligibility:', error);
      // Return safe defaults on error
      const errorRequirement: ITutorEligibilityRequirement = {
        id: 'error',
        title: 'Lỗi kiểm tra điều kiện',
        description:
          'Không thể kiểm tra điều kiện đăng bài. Vui lòng thử lại sau.',
        status: 'missing' as 'completed' | 'pending' | 'missing',
        actionText: 'Thử lại',
        actionPath: '/tutor/profile',
      };

      return {
        isEligible: false,
        requirements:
          requirements.length > 0 ? requirements : [errorRequirement],
      };
    }
  }

  /**
   * Enhance posts with structured address information for search results
   */
  private async enhancePostsWithAddressInfo(posts: any[]): Promise<any[]> {
    try {
      const { Province, District, Ward } = await import('../../models');

      const enhancedPosts = await Promise.all(
        posts.map(async (post) => {
          const postObj = post.toObject ? post.toObject() : post;

          // Enhance tutor's structured address
          if (postObj.tutorId?.structured_address) {
            const { province_code, district_code, ward_code } =
              postObj.tutorId.structured_address;

            const [province, district, ward] = await Promise.all([
              province_code ? Province.findById(province_code) : null,
              district_code ? District.findById(district_code) : null,
              ward_code ? Ward.findById(ward_code) : null,
            ]);

            postObj.tutorId.structured_address = {
              ...postObj.tutorId.structured_address,
              province_name: province?.name || null,
              district_name: district?.name || null,
              ward_name: ward?.name || null,
            };
          }

          // Enhance with tutor profile information
          const enhancedPost = await this.enhanceTutorInfo(postObj);
          return enhancedPost;
        })
      );

      return enhancedPosts;
    } catch (error) {
      console.error('Error enhancing posts with address info:', error);
      // Return original posts if enhancement fails
      return posts.map((post) => (post.toObject ? post.toObject() : post));
    }
  }

  /**
   * Enhance tutor information with additional data from TutorProfile, Education, Certificates, and Achievements
   */
  private async enhanceTutorInfo(post: any): Promise<any> {
    try {
      const tutorId = post.tutorId._id;

      // Get TutorProfile information
      const tutorProfile = await TutorProfile.findOne({
        user_id: tutorId,
      }).select(
        'headline introduction teaching_experience student_levels video_intro_link status ratingAverage ratingCount badges lastReviewAt'
      );

      // Get Province, District, Ward information
      const { Province, District, Ward } = await import('../../models');
      const province = post.tutorId.structured_address?.province_code
        ? await Province.findById(post.tutorId.structured_address.province_code)
        : null;
      const district = post.tutorId.structured_address?.district_code
        ? await District.findById(post.tutorId.structured_address.district_code)
        : null;
      const ward = post.tutorId.structured_address?.ward_code
        ? await Ward.findById(post.tutorId.structured_address.ward_code)
        : null;

      // Get Education information (without images)
      const education = await Education.find({ tutorId: tutorId })
        .select('_id level school major startYear endYear status')
        .sort({ endYear: -1 });

      // Get Certificates information (without images)
      const certificates = await Certificate.find({ tutorId: tutorId })
        .select('_id name issuingOrganization issueDate status')
        .sort({ issueDate: -1 });

      // Get Achievements information (without images)
      const achievements = await Achievement.find({ tutorId: tutorId })
        .select(
          '_id name level achievedDate awardingOrganization type field description status'
        )
        .sort({ achievedDate: -1 });

      // Enhance the tutorId object with additional information
      const enhancedTutorId = {
        ...(post.tutorId.toObject ? post.tutorId.toObject() : post.tutorId),
        structured_address: {
          ...post.tutorId.structured_address,
          province_name: province?.name || null,
          district_name: district?.name || null,
          ward_name: ward?.name || null,
        },
        profile: tutorProfile
          ? {
            headline: tutorProfile.headline,
            introduction: tutorProfile.introduction,
            teaching_experience: tutorProfile.teaching_experience,
            student_levels: tutorProfile.student_levels,
            video_intro_link: tutorProfile.video_intro_link,
            status: tutorProfile.status,
          }
          : null,
        rating: {
          average: tutorProfile?.ratingAverage || 0,
          count: tutorProfile?.ratingCount || 0,
          badges: tutorProfile?.badges || [],
          lastReviewAt: tutorProfile?.lastReviewAt || null,
        },
        education: education,
        certificates: certificates,
        achievements: achievements,
      };

      // Enhance the post's address information if it exists
      let enhancedAddress = null;
      if (post.address) {
        // Use populated data if available, otherwise fetch from database
        const { Province, District, Ward } = await import('../../models');

        let addressProvince, addressDistrict, addressWard;

        // Check if data is already populated (has name field)
        if (
          typeof post.address.province === 'object' &&
          post.address.province.name
        ) {
          addressProvince = post.address.province;
        } else if (post.address.province) {
          addressProvince = await Province.findById(post.address.province);
        }

        if (
          typeof post.address.district === 'object' &&
          post.address.district.name
        ) {
          addressDistrict = post.address.district;
        } else if (post.address.district) {
          addressDistrict = await District.findById(post.address.district);
        }

        if (typeof post.address.ward === 'object' && post.address.ward.name) {
          addressWard = post.address.ward;
        } else if (post.address.ward) {
          addressWard = await Ward.findById(post.address.ward);
        }

        enhancedAddress = {
          province: addressProvince
            ? {
              _id: addressProvince._id,
              name: addressProvince.name,
            }
            : null,
          district: addressDistrict
            ? {
              _id: addressDistrict._id,
              name: addressDistrict.name,
            }
            : null,
          ward: addressWard
            ? {
              _id: addressWard._id,
              name: addressWard.name,
            }
            : null,
          specificAddress: post.address.specificAddress || null,
        };
      }

      // Return enhanced post
      return {
        ...(post.toObject ? post.toObject() : post),
        tutorId: enhancedTutorId,
        address: enhancedAddress,
      };
    } catch (error) {
      console.error('Error enhancing tutor info:', error);
      // Return original post if enhancement fails
      return post;
    }
  }
}

export const tutorPostService = new TutorPostService();
