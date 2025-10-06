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

  // ✅ Enhanced search method with comprehensive filtering
 // ✅ Enhanced search method with comprehensive text search
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
      search, // ✅ Comprehensive text search
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    console.log('🔍 Searching tutor posts with query:', query);

    // Build base filter
    const filter: any = {
      status: 'ACTIVE',
      tutorId: {
        $in: await this.getVerifiedTutorIds(),
      },
    };

    // ✅ Subject filter - Direct filter without status validation
    if (subjects && subjects.length > 0) {
      console.log('🎯 Applying subjects filter:', subjects);
      filter.subjects = { $in: subjects };
    }

    // Teaching mode filter
    if (teachingMode) {
      console.log('🏫 Applying teaching mode filter:', teachingMode);
      if (teachingMode === 'BOTH') {
        filter.teachingMode = { $in: ['ONLINE', 'OFFLINE', 'BOTH'] };
      } else {
        filter.teachingMode = { $in: [teachingMode, 'BOTH'] };
      }
    }

    // Student level filter
    if (studentLevel && studentLevel.length > 0) {
      console.log('🎓 Applying student level filter:', studentLevel);
      filter.studentLevel = { $in: studentLevel };
    }

    // Price range filter
    if (priceMin !== undefined || priceMax !== undefined) {
      console.log('💰 Applying price filter:', { priceMin, priceMax });
      filter.pricePerSession = {};
      if (priceMin !== undefined) filter.pricePerSession.$gte = priceMin;
      if (priceMax !== undefined) filter.pricePerSession.$lte = priceMax;
    }

    // Location filters
    if (province || district) {
      console.log('📍 Applying location filter:', { province, district });
      const locationFilter: any = {};

      if (province) {
        const provinceObj = await Province.findOne({
          $or: [
            { code: province },
            { name: { $regex: province, $options: 'i' } },
          ],
        });

        if (provinceObj) {
          locationFilter['address.province'] = provinceObj.code;
        }
      }

      if (district && province) {
        const districtObj = await District.findOne({
          $or: [
            { code: district },
            { name: { $regex: district, $options: 'i' } },
          ],
        });

        if (districtObj) {
          locationFilter['address.district'] = districtObj.code;
        }
      }

      Object.assign(filter, locationFilter);
    }

    console.log('📋 Built filter:', JSON.stringify(filter, null, 2));

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    if (sortBy !== 'createdAt') {
      sort.createdAt = -1;
    }

    // ✅ Always use aggregation for comprehensive search capabilities
    const aggregationPipeline = [
      { $match: filter },

      // ✅ Lookup tutor information
      {
        $lookup: {
          from: 'users',
          localField: 'tutorId',
          foreignField: '_id',
          as: 'tutorInfo',
        },
      },
      { $unwind: '$tutorInfo' },

      // ✅ Lookup subjects for search
      {
        $lookup: {
          from: 'subjects',
          localField: 'subjects',
          foreignField: '_id',
          as: 'subjectDetails',
        },
      },

      // ✅ Lookup address information for search
      {
        $lookup: {
          from: 'provinces',
          localField: 'address.province',
          foreignField: 'code',
          as: 'provinceInfo',
        },
      },
      {
        $lookup: {
          from: 'districts',
          localField: 'address.district',
          foreignField: 'code',
          as: 'districtInfo',
        },
      },

      // ✅ Comprehensive text search filter
      ...(search && search.trim() ? [
        {
          $match: {
            $or: [
              // Search in post title & description
              { title: { $regex: search.trim(), $options: 'i' } },
              { description: { $regex: search.trim(), $options: 'i' } },
              
              // Search in tutor name
              { 'tutorInfo.full_name': { $regex: search.trim(), $options: 'i' } },
              
              // Search in subject names
              { 'subjectDetails.name': { $regex: search.trim(), $options: 'i' } },
              
              // Search in location names
              { 'provinceInfo.name': { $regex: search.trim(), $options: 'i' } },
              { 'districtInfo.name': { $regex: search.trim(), $options: 'i' } },
              
              // Search in address text
              { 'address.addressText': { $regex: search.trim(), $options: 'i' } },
              
              // Search in tutor profile headline
              { 'tutorInfo.profile.headline': { $regex: search.trim(), $options: 'i' } },
            ],
          },
        }
      ] : []),

      // ✅ Add relevance score when searching
      ...(search && search.trim() ? [
        {
          $addFields: {
            relevanceScore: {
              $add: [
                // Title match gets highest score (20 points)
                {
                  $cond: [
                    { $regexMatch: { input: '$title', regex: search.trim(), options: 'i' } },
                    20,
                    0
                  ]
                },
                // Tutor name match (15 points)
                {
                  $cond: [
                    { $regexMatch: { input: '$tutorInfo.full_name', regex: search.trim(), options: 'i' } },
                    15,
                    0
                  ]
                },
                // Subject name match (10 points)
                {
                  $cond: [
                    { $gt: [{ $size: { $filter: {
                      input: '$subjectDetails',
                      cond: { $regexMatch: { input: '$$this.name', regex: search.trim(), options: 'i' } }
                    }}}, 0] },
                    10,
                    0
                  ]
                },
                // Description match (8 points)
                {
                  $cond: [
                    { $regexMatch: { input: '$description', regex: search.trim(), options: 'i' } },
                    8,
                    0
                  ]
                },
                // Location match (5 points)
                {
                  $cond: [
                    { $or: [
                      { $gt: [{ $size: '$provinceInfo' }, 0] },
                      { $gt: [{ $size: '$districtInfo' }, 0] }
                    ]},
                    5,
                    0
                  ]
                },
                // Address text match (3 points)
                {
                  $cond: [
                    { $regexMatch: { input: { $ifNull: ['$address.addressText', ''] }, regex: search.trim(), options: 'i' } },
                    3,
                    0
                  ]
                },
                // Add popularity bonus
                { $multiply: ['$viewCount', 0.1] },
                { $multiply: ['$contactCount', 0.3] },
              ],
            },
          },
        }
      ] : []),

      // ✅ Sort by relevance when searching, otherwise by selected sort
      { 
        $sort: search && search.trim() ? 
          { relevanceScore: -1, [sortBy]: sortOrder === 'asc' ? 1 : -1 } : 
          sort 
      },

      // Pagination
      { $skip: skip },
      { $limit: limit },

      // Final projection
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          subjects: '$subjectDetails',
          pricePerSession: 1,
          sessionDuration: 1,
          teachingMode: 1,
          studentLevel: 1,
          teachingSchedule: 1,
          address: 1,
          status: 1,
          viewCount: 1,
          contactCount: 1,
          createdAt: 1,
          updatedAt: 1,
          tutorId: {
            _id: '$tutorInfo._id',
            full_name: '$tutorInfo.full_name',
            email: '$tutorInfo.email',
            gender: '$tutorInfo.gender',
            date_of_birth: '$tutorInfo.date_of_birth',
            avatar_url: '$tutorInfo.avatar_url',
            structured_address: '$tutorInfo.structured_address',
            profile: '$tutorInfo.profile',
          },
          // Include relevance score for debugging
          ...(search && search.trim() ? { relevanceScore: 1 } : {}),
        },
      },
    ];

    // ✅ Count pipeline with same comprehensive search
    const countPipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'tutorId',
          foreignField: '_id',
          as: 'tutorInfo',
        },
      },
      { $unwind: '$tutorInfo' },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subjects',
          foreignField: '_id',
          as: 'subjectDetails',
        },
      },
      {
        $lookup: {
          from: 'provinces',
          localField: 'address.province',
          foreignField: 'code',
          as: 'provinceInfo',
        },
      },
      {
        $lookup: {
          from: 'districts',
          localField: 'address.district',
          foreignField: 'code',
          as: 'districtInfo',
        },
      },
      ...(search && search.trim() ? [
        {
          $match: {
            $or: [
              { title: { $regex: search.trim(), $options: 'i' } },
              { description: { $regex: search.trim(), $options: 'i' } },
              { 'tutorInfo.full_name': { $regex: search.trim(), $options: 'i' } },
              { 'subjectDetails.name': { $regex: search.trim(), $options: 'i' } },
              { 'provinceInfo.name': { $regex: search.trim(), $options: 'i' } },
              { 'districtInfo.name': { $regex: search.trim(), $options: 'i' } },
              { 'address.addressText': { $regex: search.trim(), $options: 'i' } },
              { 'tutorInfo.profile.headline': { $regex: search.trim(), $options: 'i' } },
            ],
          },
        }
      ] : []),
      { $count: 'total' },
    ];

    const totalResult = await TutorPost.aggregate(countPipeline);
    const totalItems = totalResult[0]?.total || 0;

    // Execute main query
    const posts = await TutorPost.aggregate(aggregationPipeline);

    if (search && search.trim()) {
      console.log(`✅ Comprehensive text search completed for "${search.trim()}": ${posts.length} posts found (${totalItems} total)`);
      
      // Log top matches with relevance scores for debugging
      const topMatches = posts.slice(0, 3).map(post => ({
        title: post.title,
        tutorName: post.tutorId.full_name,
        relevanceScore: post.relevanceScore
      }));
      console.log('🎯 Top matches:', topMatches);
    } else {
      console.log(`✅ Filter search completed: ${posts.length} posts found (${totalItems} total)`);
    }

    // Build pagination info
    const totalPages = Math.ceil(totalItems / limit);

    return {
      posts,
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

  // ✅ Get single tutor post by ID
  async getTutorPostById(postId: string): Promise<ITutorPost | null> {
    try {
      const post = await TutorPost.findById(postId)
        .populate('subjects', 'name category')
        .populate('tutorId', 'full_name email gender date_of_birth avatar_url structured_address')
        .lean();

      if (!post) {
        return null;
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
  async activatePost(postId: string, tutorId: string): Promise<ITutorPost | null> {
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
  async deactivatePost(postId: string, tutorId: string): Promise<ITutorPost | null> {
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
        tutorId: tutorId
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

  // Public method for frontend to check eligibility
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

      // Check tutor profile
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
          profileActionText = 'Chờ xác minh';
        }
      }

      const profileRequirement: ITutorEligibilityRequirement = {
        id: 'tutor-profile',
        title: 'Hồ sơ gia sư đã được xác thực',
        description:
          'Thông tin cá nhân và kinh nghiệm giảng dạy đã được xác minh',
        status: profileStatus,
        actionPath: '/tutor/profile',
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
          tutorId: tutorId, // Use the original tutorId (User ID)
        }).select('status');

        const verifiedEducations = educations.filter(
          (edu) => edu.status === 'VERIFIED'
        );
        const pendingEducations = educations.filter(
          (edu) => edu.status === 'PENDING' || edu.status === 'MODIFIED_PENDING'
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
        title: 'Trình độ học vấn được xác thực',
        description: 'Trình độ học vấn đã được kiểm tra và xác nhận',
        status: educationStatus,
        actionPath: '/tutor/qualifications?tab=education',
      };
      if (educationActionText) {
        educationRequirement.actionText = educationActionText;
      }
      requirements.push(educationRequirement);

      // Determine overall eligibility
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
        'headline introduction teaching_experience student_levels video_intro_link status'
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
        education: education,
        certificates: certificates,
        achievements: achievements,
      };

      // Return enhanced post
      return {
        ...(post.toObject ? post.toObject() : post),
        tutorId: enhancedTutorId,
      };
    } catch (error) {
      console.error('Error enhancing tutor info:', error);
      // Return original post if enhancement fails
      return post;
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

      // 3. Kiểm tra có ít nhất một trình độ học vấn được xác thực
      const verifiedEducations = await Education.find({
        tutorId: tutorId, // Use the original tutorId (User ID)
        status: 'VERIFIED',
      }).select('_id level school major');

      if (verifiedEducations.length === 0) {
        throw new Error(
          'At least one education qualification must be verified. Please add and verify your educational background.'
        );
      }

      // 4. Log successful validation
      console.log(`✅ Tutor qualification validated for user ${tutorId}:`, {
        profileStatus: tutorProfile.status,
        verifiedEducations: verifiedEducations.length,
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
    newSchedule: ITeachingSchedule[]
  ): Promise<void> {
    // Get existing active posts from this tutor
    const existingPosts = await TutorPost.find({
      tutorId: tutorId,
      status: 'ACTIVE',
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
}

export const tutorPostService = new TutorPostService();
