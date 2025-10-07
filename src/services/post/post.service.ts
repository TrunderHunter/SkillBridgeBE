import { IPost, Post, PostStatus, PostType } from '../../models/Post';
import { User } from '../../models/User';
import { UserRole } from '../../types/user.types';
import {
  IPostInput,
  IPostUpdateInput,
  IPostReviewInput,
  IPostFilterOptions,
  IPostPaginationOptions,
} from '../../types/post.types';
import { mapPostToResponse } from '../../utils/mappers/post.mapper';
import { TutorPost } from '../../models/TutorPost';
import { Subject } from '../../models/Subject';
import { mapTutorPostToResponse } from '../../utils/mappers/tutorPost.mapper';

export interface ITutorSearchQuery {
  // Core filters
  subjects?: string[];
  teachingMode?: 'ONLINE' | 'OFFLINE' | 'BOTH';
  studentLevel?: string[];
  
  // Price filters
  priceMin?: number;
  priceMax?: number;
  
  // Location filters
  province?: string;
  district?: string;
  ward?: string;
  
  // Search & pagination
  search?: string;
  page?: number;
  limit?: number;
  
  // Sorting
  sortBy?: 'createdAt' | 'pricePerSession' | 'viewCount' | 'contactCount';
  sortOrder?: 'asc' | 'desc';
  
  // Special filters
  featured?: boolean; // Get featured tutors
  subjectId?: string; // Filter by specific subject
}

export interface ITutorSearchPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class PostService {
  // Tạo bài đăng mới
  static async createPost(userId: string, postData: IPostInput): Promise<any> {
    try {
      const post = await Post.create({ ...postData, author_id: userId });
      await post.populate({ path: 'author_id', select: 'full_name avatar' });

      return {
        success: true,
        message: 'Đăng bài thành công, đang chờ duyệt',
        data: mapPostToResponse(post.toObject())
      };
    } catch (error: any) {
      return { success: false, message: error.message || 'Lỗi khi tạo bài đăng' };
    }
  }

  // Lấy danh sách bài đăng với bộ lọc và phân trang
  static async getPosts(
    filterOptions: IPostFilterOptions = {},
    paginationOptions: IPostPaginationOptions = {}
  ): Promise<any> {
    try {
      const { status, subjects, grade_levels, is_online, author_id, search_term } = filterOptions;
      const { page = 1, limit = 10, sort_by = 'created_at', sort_order = 'desc' } = paginationOptions;

      // Xây dựng query
      const query: any = {};

      // Áp dụng các bộ lọc
      if (status) query.status = status;
      if (subjects && subjects.length > 0) query.subjects = { $in: subjects };
      if (grade_levels && grade_levels.length > 0) query.grade_levels = { $in: grade_levels };
      if (is_online !== undefined) query.is_online = is_online;
      if (author_id) query.author_id = author_id;
      if (search_term) {
        query.$or = [
          { title: { $regex: search_term, $options: 'i' } },
          { content: { $regex: search_term, $options: 'i' } },
        ];
      }

      // Thực hiện query với phân trang
      const sortDirection = sort_order === 'asc' ? 1 : -1;
      const sortOptions: any = {};
      sortOptions[sort_by] = sortDirection;

      const skip = (page - 1) * limit;

      const [posts, totalCount] = await Promise.all([
        Post.find(query)
          .populate('author_id', 'full_name avatar')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Post.countDocuments(query),
      ]);

      return {
        success: true,
        message: 'Lấy danh sách bài đăng thành công',
        data: {
          posts: posts.map(mapPostToResponse),
          pagination: {
            total: totalCount,
            page,
            limit,
            pages: Math.ceil(totalCount / limit),
          },
        },
      };
    } catch (error: any) {
      return { success: false, message: error.message || 'Lỗi khi lấy danh sách bài đăng' };
    }
  }

  // Lấy chi tiết bài đăng theo ID
  static async getPostById(postId: string): Promise<any> {
    try {
      const post = await Post.findById(postId).populate('author_id', 'full_name avatar').lean();

      if (!post) {
        return { success: false, message: 'Không tìm thấy bài đăng' };
      }

      return { success: true, message: 'Lấy chi tiết bài đăng thành công', data: mapPostToResponse(post) };
    } catch (error: any) {
      return { success: false, message: error.message || 'Lỗi khi lấy chi tiết bài đăng' };
    }
  }

  // Cập nhật bài đăng
  static async updatePost(postId: string, userId: string, updateData: IPostUpdateInput): Promise<any> {
    try {
      const post = await Post.findById(postId);

      if (!post) {
        return { success: false, message: 'Không tìm thấy bài đăng' };
      }

      // Kiểm tra quyền sở hữu
      if (post.author_id.toString() !== userId) {
        return { success: false, message: 'Bạn không có quyền cập nhật bài đăng này' };
      }

      // Chỉ cho phép cập nhật khi bài đăng đang ở trạng thái PENDING hoặc REJECTED
      if (![PostStatus.PENDING, PostStatus.REJECTED].includes(post.status as PostStatus)) {
        return {
          success: false,
          message: 'Chỉ có thể cập nhật bài đăng đang chờ duyệt hoặc bị từ chối',
        };
      }

      // Cập nhật trạng thái về PENDING nếu đang REJECTED
      if (post.status === PostStatus.REJECTED) {
        post.status = PostStatus.PENDING;
      }

      // Cập nhật thông tin
      Object.assign(post, updateData);
      await post.save();
      await post.populate({ path: 'author_id', select: 'full_name avatar' });

      return {
        success: true,
        message: 'Cập nhật bài đăng thành công',
        data: mapPostToResponse(post.toObject())
      };
    } catch (error: any) {
      return { success: false, message: error.message || 'Lỗi khi cập nhật bài đăng' };
    }
  }

  // Xóa bài đăng
  static async deletePost(postId: string, userId: string): Promise<any> {
    try {
      const post = await Post.findById(postId);

      if (!post) {
        return { success: false, message: 'Không tìm thấy bài đăng' };
      }

      // Kiểm tra quyền sở hữu hoặc quyền admin
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: 'Người dùng không tồn tại' };
      }

      if (post.author_id.toString() !== userId && user.role !== UserRole.ADMIN) {
        return { success: false, message: 'Bạn không có quyền xóa bài đăng này' };
      }

      await Post.findByIdAndDelete(postId);

      return { success: true, message: 'Xóa bài đăng thành công' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Lỗi khi xóa bài đăng' };
    }
  }

  // Admin duyệt bài đăng
  static async reviewPost(postId: string, adminId: string, reviewData: IPostReviewInput): Promise<any> {
    try {
      const post = await Post.findById(postId);

      if (!post) {
        return { success: false, message: 'Không tìm thấy bài đăng' };
      }

      // Kiểm tra quyền admin
      const admin = await User.findById(adminId);
      if (!admin || admin.role !== UserRole.ADMIN) {
        return { success: false, message: 'Bạn không có quyền duyệt bài đăng' };
      }

      // Cập nhật trạng thái và thông tin duyệt
      post.status = reviewData.status;
      post.admin_note = reviewData.admin_note || '';
      post.reviewed_at = new Date();
      post.reviewed_by = adminId;

      await post.save();
      await post.populate({ path: 'author_id', select: 'full_name avatar' });

      return {
        success: true,
        message: `Bài đăng đã được ${reviewData.status === PostStatus.APPROVED ? 'phê duyệt' : 'từ chối'}`,
        data: mapPostToResponse(post.toObject()),
      };
    } catch (error: any) {
      return { success: false, message: error.message || 'Lỗi khi duyệt bài đăng' };
    }
  }

  // Tìm gia sư thông minh dựa trên bài đăng của học viên
  static async smartSearchTutors(
    studentPostId: string,
    paginationOptions: IPostPaginationOptions = {}
  ): Promise<any> {
    try {
      const { page = 1, limit = 10, sort_by = 'compatibility', sort_order = 'desc' } = paginationOptions;

      const studentPost = await Post.findById(studentPostId).lean();
      if (!studentPost) {
        return { success: false, message: 'Không tìm thấy bài đăng của học viên' };
      }

      // Lấy tất cả tutor posts active, populate cần thiết
      const tutorPosts = await TutorPost.find({ status: 'ACTIVE' })
        .populate('subjects', 'name category')
        .populate('tutorId', 'full_name email gender date_of_birth avatar_url structured_address')
        .populate('address.province address.district address.ward', 'name')
        .lean();

      // Tính score
      const scoredPosts = tutorPosts.map(tp => ({
        post: tp,
        score: PostService.calculateCompatibility(studentPost, tp)
      }));

      // Sort
      const sortDirection = sort_order === 'desc' ? -1 : 1;
      scoredPosts.sort((a, b) => sortDirection * (b.score - a.score));

      // Paginate
      const skip = (page - 1) * limit;
      const paginated = scoredPosts.slice(skip, skip + limit);
      const total = scoredPosts.length;

      return {
        success: true,
        message: 'Tìm kiếm gia sư thông minh thành công',
        data: {
          tutors: paginated.map(p => ({ ...p.post, compatibility: Math.round(p.score) })),
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error: any) {
      return { success: false, message: error.message || 'Lỗi khi tìm kiếm gia sư thông minh' };
    }
  }

  private static calculateCompatibility(student: IPost, tutor: any): number {
    let score = 0;

    // Subjects (30%)
    const subjectMatch = student.subjects.filter((s: string) => tutor.subjects.some((ts: any) => ts.name === s)).length / (student.subjects.length || 1);
    score += 30 * subjectMatch;

    // Grade levels (20%)
    const gradeMatch = student.grade_levels.filter((g: string) => tutor.studentLevel.includes(g)).length / (student.grade_levels.length || 1);
    score += 20 * gradeMatch;

    // Teaching mode (20%)
    let modeMatch = 0;
    const studentMode = student.is_online ? 'ONLINE' : 'OFFLINE';
    if (tutor.teachingMode === studentMode || tutor.teachingMode === 'BOTH') {
      modeMatch = 1;
    }
    score += 20 * modeMatch;

    // Price (20%)
    let priceMatch = 0;
    if (student.hourly_rate && student.hourly_rate.min !== undefined && student.hourly_rate.max !== undefined) {
      if (tutor.pricePerSession >= student.hourly_rate.min && tutor.pricePerSession <= student.hourly_rate.max) {
        priceMatch = 1;
      }
    } else {
      priceMatch = 1;
    }
    score += 20 * priceMatch;

    // Location (10%) - basic
    let locationMatch = 0;
    if (!student.is_online && student.location && tutor.address && tutor.address.province) {
      if (student.location.toLowerCase().includes(tutor.address.province.name.toLowerCase())) {
        locationMatch = 1;
      }
    } else {
      locationMatch = 1;
    }
    score += 10 * locationMatch;

    return score;
  }

  // ✅ Search Tutors for Students (Regular Search)
  static async searchTutors(searchQuery: ITutorSearchQuery = {}): Promise<any> {
    try {
      const {
        subjects,
        teachingMode,
        studentLevel,
        priceMin,
        priceMax,
        province,
        district,
        ward,
        search,
        page = 1,
        limit = 12,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        featured = false,
        subjectId
      } = searchQuery;

      console.log('🔍 Universal Tutor Search:', searchQuery);

      // Build dynamic MongoDB query
      const query: any = {
        status: 'ACTIVE'
      };

      // ✅ Subject filters (multiple ways)
      if (subjectId) {
        // Single subject filter (from URL param or query)
        query.subjects = { $in: [subjectId] };
      } else if (subjects && subjects.length > 0) {
        // Multiple subjects filter
        query.subjects = { $in: subjects };
      }

      // ✅ Teaching mode filter
      if (teachingMode) {
        if (teachingMode === 'ONLINE') {
          query.teachingMode = { $in: ['ONLINE', 'BOTH'] };
        } else if (teachingMode === 'OFFLINE') {
          query.teachingMode = { $in: ['OFFLINE', 'BOTH'] };
        } else if (teachingMode === 'BOTH') {
          query.teachingMode = 'BOTH';
        }
      }

      // ✅ Student level filter
      if (studentLevel && studentLevel.length > 0) {
        query.studentLevel = { $in: studentLevel };
      }

      // ✅ Price range filter
      if (priceMin !== undefined || priceMax !== undefined) {
        query.pricePerSession = {};
        if (priceMin !== undefined) query.pricePerSession.$gte = priceMin;
        if (priceMax !== undefined) query.pricePerSession.$lte = priceMax;
      }

      // ✅ Location filters (flexible)
      const locationFilters = [];
      if (province || district || ward) {
        const addressQuery: any = {};
        if (ward) addressQuery['address.ward'] = ward;
        else if (district) addressQuery['address.district'] = district;
        else if (province) addressQuery['address.province'] = province;
        
        locationFilters.push(addressQuery);
        
        // Also include tutors from structured_address
        const tutorLocationQuery: any = {};
        if (ward) tutorLocationQuery['tutorId.structured_address.ward_name'] = new RegExp(ward, 'i');
        else if (district) tutorLocationQuery['tutorId.structured_address.district_name'] = new RegExp(district, 'i');
        else if (province) tutorLocationQuery['tutorId.structured_address.province_name'] = new RegExp(province, 'i');
        
        locationFilters.push(tutorLocationQuery);
        
        // Always include online tutors (can teach anywhere)
        locationFilters.push({ teachingMode: { $in: ['ONLINE', 'BOTH'] } });
        
        query.$or = locationFilters;
      }

      // ✅ Text search (flexible)
      if (search && search.trim()) {
        const searchRegex = { $regex: search.trim(), $options: 'i' };
        const searchFilters = [
          { title: searchRegex },
          { description: searchRegex },
          { 'tutorId.full_name': searchRegex }
        ];
        
        // Combine with location filters if exist
        if (query.$or) {
          query.$and = [
            { $or: query.$or }, // Location filters
            { $or: searchFilters } // Search filters
          ];
          delete query.$or;
        } else {
          query.$or = searchFilters;
        }
      }

      // ✅ Dynamic sorting
      const sortOptions: any = {};
      
      if (featured) {
        // Featured tutors: prioritize by engagement
        sortOptions.viewCount = -1;
        sortOptions.contactCount = -1;
        sortOptions.createdAt = -1;
      } else {
        // Regular sorting
        const sortDirection = sortOrder === 'asc' ? 1 : -1;
        switch (sortBy) {
          case 'pricePerSession':
            sortOptions.pricePerSession = sortDirection;
            break;
          case 'viewCount':
            sortOptions.viewCount = sortDirection;
            break;
          case 'contactCount':
            sortOptions.contactCount = sortDirection;
            break;
          default:
            sortOptions.createdAt = sortDirection;
        }
        
        // Secondary sort for consistency
        if (sortBy !== 'createdAt') {
          sortOptions.createdAt = -1;
        }
      }

      // ✅ Pagination
      const skip = (page - 1) * limit;
      
      // Limit for featured
      const actualLimit = featured ? Math.min(limit, 8) : limit;

      console.log('📊 MongoDB Query:', JSON.stringify(query, null, 2));
      console.log('🔧 Sort Options:', sortOptions);

      // ✅ Execute search
      const [tutors, totalCount] = await Promise.all([
        TutorPost.find(query)
          .populate({
            path: 'subjects',
            select: 'name category',
            model: 'Subject'
          })
          .populate({
            path: 'tutorId',
            select: 'full_name email gender date_of_birth avatar_url structured_address profile education certificates achievements',
            model: 'User',
            match: { role: 'tutor', status: 'active' }
          })
          .populate('address.province address.district address.ward', 'name code')
          .sort(sortOptions)
          .skip(skip)
          .limit(actualLimit)
          .lean(),
        TutorPost.countDocuments(query)
      ]);

      // Filter valid tutors
      const validTutors = tutors.filter(tutor => tutor.tutorId);

      console.log(`✅ Found ${validTutors.length}/${tutors.length} valid tutors (${totalCount} total)`);

      // ✅ Build response
      const pagination = {
        total: totalCount,
        page,
        limit: actualLimit,
        pages: Math.ceil(totalCount / actualLimit),
        hasNext: page < Math.ceil(totalCount / actualLimit),
        hasPrev: page > 1
      };

      return {
        success: true,
        message: featured ? 'Lấy gia sư nổi bật thành công' : 'Tìm kiếm gia sư thành công',
        data: {
          tutors: validTutors.map(mapTutorPostToResponse),
          pagination,
          filters: {
            applied: Object.keys(searchQuery).filter(key => 
              searchQuery[key as keyof ITutorSearchQuery] !== undefined && 
              searchQuery[key as keyof ITutorSearchQuery] !== ''
            ),
            ...searchQuery
          },
          summary: {
            total: totalCount,
            found: validTutors.length,
            page,
            limit: actualLimit,
            hasFilters: Object.keys(searchQuery).length > 2 // more than page & limit
          }
        }
      };
    } catch (error: any) {
      console.error('❌ Universal search error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi tìm kiếm gia sư',
        error: error
      };
    }
  }

  // ✅ SIMPLIFIED: Get filter options
  static async getSearchFilterOptions(): Promise<any> {
    try {
      // Get active subjects grouped by category
      const subjects = await Subject.find({ status: 'active' })
        .select('_id name category')
        .sort({ category: 1, name: 1 })
        .lean();

      const subjectsByCategory = subjects.reduce((acc: any, subject) => {
        const category = subject.category || 'Khác';
        if (!acc[category]) acc[category] = [];
        acc[category].push(subject);
        return acc;
      }, {});

      return {
        success: true,
        message: 'Lấy tùy chọn bộ lọc thành công',
        data: {
          subjects: {
            all: subjects,
            byCategory: subjectsByCategory
          },
          studentLevels: [
            { value: 'TIEU_HOC', label: 'Tiểu học' },
            { value: 'TRUNG_HOC_CO_SO', label: 'Trung học cơ sở' },
            { value: 'TRUNG_HOC_PHO_THONG', label: 'Trung học phổ thông' },
            { value: 'DAI_HOC', label: 'Đại học' },
            { value: 'NGUOI_DI_LAM', label: 'Người đi làm' },
            { value: 'KHAC', label: 'Khác' }
          ],
          teachingModes: [
            { value: 'ONLINE', label: 'Trực tuyến', icon: '💻' },
            { value: 'OFFLINE', label: 'Tại nhà', icon: '🏠' },
            { value: 'BOTH', label: 'Cả hai hình thức', icon: '🔄' }
          ],
          priceRanges: [
            { label: 'Dưới 200k', min: 0, max: 200000 },
            { label: '200k - 500k', min: 200000, max: 500000 },
            { label: '500k - 1M', min: 500000, max: 1000000 },
            { label: '1M - 2M', min: 1000000, max: 2000000 },
            { label: 'Trên 2M', min: 2000000, max: 10000000 }
          ],
          sortOptions: [
            { value: 'createdAt', label: 'Mới nhất', icon: '🕒' },
            { value: 'pricePerSession', label: 'Giá tiền', icon: '💰' },
            { value: 'viewCount', label: 'Lượt xem', icon: '👀' },
            { value: 'contactCount', label: 'Lượt liên hệ', icon: '📞' }
          ]
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy tùy chọn bộ lọc'
      };
    }
  }

  // ✅ Get Featured Tutors
  static async getFeaturedTutors(limit: number = 8): Promise<any> {
    try {
      console.log('⭐ Getting featured tutors, limit:', limit);

      const tutors = await TutorPost.find({ 
        status: 'ACTIVE'
      })
        .populate({
          path: 'subjects',
          select: 'name category',
          model: 'Subject'
        })
        .populate({
          path: 'tutorId',
          select: 'full_name email gender date_of_birth avatar_url structured_address profile education certificates',
          model: 'User',
          match: { role: 'tutor', status: 'active' }
        })
        .populate('address.province address.district address.ward', 'name code')
        .sort({ 
          viewCount: -1,
          contactCount: -1,
          createdAt: -1
        })
        .limit(limit)
        .lean();

      // Filter valid tutors
      const validTutors = tutors.filter(tutor => tutor.tutorId);

      return {
        success: true,
        message: 'Lấy danh sách gia sư nổi bật thành công',
        data: {
          tutors: validTutors.map(mapTutorPostToResponse),
          count: validTutors.length
        }
      };
    } catch (error: any) {
      console.error('❌ Get featured tutors error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách gia sư nổi bật'
      };
    }
  }

  // ✅ Get Tutors by Subject
  static async getTutorsBySubject(
    subjectId: string,
    page: number = 1,
    limit: number = 12
  ): Promise<any> {
    try {
      console.log('📚 Getting tutors by subject:', subjectId);

      const query = {
        status: 'ACTIVE',
        subjects: { $in: [subjectId] }
      };

      const skip = (page - 1) * limit;

      const [tutors, totalCount] = await Promise.all([
        TutorPost.find(query)
          .populate({
            path: 'subjects',
            select: 'name category',
            model: 'Subject'
          })
          .populate({
            path: 'tutorId',
            select: 'full_name email gender date_of_birth avatar_url structured_address profile',
            model: 'User',
            match: { role: 'tutor', status: 'active' }
          })
          .populate('address.province address.district address.ward', 'name code')
          .sort({ 
            viewCount: -1, 
            contactCount: -1,
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .lean(),
        TutorPost.countDocuments(query)
      ]);

      const validTutors = tutors.filter(tutor => tutor.tutorId);

      const pagination: ITutorSearchPagination = {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      };

      return {
        success: true,
        message: 'Lấy danh sách gia sư theo môn học thành công',
        data: {
          tutors: validTutors.map(mapTutorPostToResponse),
          pagination
        }
      };
    } catch (error: any) {
      console.error('❌ Get tutors by subject error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách gia sư theo môn học'
      };
    }
  }

  // ✅ Get Tutors by Location
  static async getTutorsByLocation(
    province?: string,
    district?: string,
    page: number = 1,
    limit: number = 12
  ): Promise<any> {
    try {
      console.log('📍 Getting tutors by location:', { province, district });

      const locationQuery: any = {};
      if (province) locationQuery['address.province'] = province;
      if (district) locationQuery['address.district'] = district;

      const query = {
        status: 'ACTIVE',
        $or: [
          locationQuery,
          { teachingMode: { $in: ['ONLINE', 'BOTH'] } }
        ]
      };

      const skip = (page - 1) * limit;

      const [tutors, totalCount] = await Promise.all([
        TutorPost.find(query)
          .populate({
            path: 'subjects',
            select: 'name category',
            model: 'Subject'
          })
          .populate({
            path: 'tutorId',
            select: 'full_name email gender date_of_birth avatar_url structured_address profile',
            model: 'User',
            match: { role: 'tutor', status: 'active' }
          })
          .populate('address.province address.district address.ward', 'name code')
          .sort({ 
            viewCount: -1, 
            contactCount: -1,
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .lean(),
        TutorPost.countDocuments(query)
      ]);

      const validTutors = tutors.filter(tutor => tutor.tutorId);

      const pagination: ITutorSearchPagination = {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      };

      return {
        success: true,
        message: 'Lấy danh sách gia sư theo khu vực thành công',
        data: {
          tutors: validTutors.map(mapTutorPostToResponse),
          pagination
        }
      };
    } catch (error: any) {
      console.error('❌ Get tutors by location error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách gia sư theo khu vực'
      };
    }
  }

  // ✅ Get Tutor Detail by ID
  static async getTutorById(tutorPostId: string): Promise<any> {
    try {
      console.log('👤 Getting tutor detail:', tutorPostId);

      const tutor = await TutorPost.findById(tutorPostId)
        .populate({
          path: 'subjects',
          select: 'name category description',
          model: 'Subject'
        })
        .populate({
          path: 'tutorId',
          select: 'full_name email gender date_of_birth avatar_url structured_address profile education certificates achievements',
          model: 'User'
        })
        .populate('address.province address.district address.ward', 'name code')
        .lean();

      if (!tutor) {
        return {
          success: false,
          message: 'Không tìm thấy gia sư'
        };
      }

      if (!tutor.tutorId) {
        return {
          success: false,
          message: 'Gia sư không khả dụng'
        };
      }

      // Increment view count
      await TutorPost.findByIdAndUpdate(tutorPostId, { $inc: { viewCount: 1 } });

      return {
        success: true,
        message: 'Lấy thông tin gia sư thành công',
        data: {
          tutor: mapTutorPostToResponse(tutor)
        }
      };
    } catch (error: any) {
      console.error('❌ Get tutor by ID error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy thông tin gia sư'
      };
    }
  }

  // ✅ Contact Tutor (Increment contact count)
  static async contactTutor(tutorPostId: string): Promise<any> {
    try {
      console.log('📞 Contact tutor:', tutorPostId);

      const tutor = await TutorPost.findByIdAndUpdate(
        tutorPostId,
        { $inc: { contactCount: 1 } },
        { new: true }
      );

      if (!tutor) {
        return {
          success: false,
          message: 'Không tìm thấy gia sư'
        };
      }

      return {
        success: true,
        message: 'Đã ghi nhận liên hệ với gia sư',
        data: {
          contactCount: tutor.contactCount
        }
      };
    } catch (error: any) {
      console.error('❌ Contact tutor error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi liên hệ gia sư'
      };
    }
  }

  // // ✅ Get Search Filter Options
  // static async getSearchFilterOptions(): Promise<any> {
  //   try {
  //     console.log('🔧 Getting search filter options');

  //     // Get active subjects
  //     const subjects = await Subject.find({ status: 'active' })
  //       .select('_id name category')
  //       .sort({ category: 1, name: 1 })
  //       .lean();

  //     // Group subjects by category
  //     const subjectsByCategory = subjects.reduce((acc: any, subject) => {
  //       const category = subject.category || 'Khác';
  //       if (!acc[category]) acc[category] = [];
  //       acc[category].push(subject);
  //       return acc;
  //     }, {});

  //     // Static options
  //     const studentLevels = [
  //       { value: 'TIEU_HOC', label: 'Tiểu học' },
  //       { value: 'TRUNG_HOC_CO_SO', label: 'Trung học cơ sở' },
  //       { value: 'TRUNG_HOC_PHO_THONG', label: 'Trung học phổ thông' },
  //       { value: 'DAI_HOC', label: 'Đại học' },
  //       { value: 'NGUOI_DI_LAM', label: 'Người đi làm' },
  //       { value: 'KHAC', label: 'Khác' }
  //     ];

  //     const teachingModes = [
  //       { value: 'ONLINE', label: 'Trực tuyến', icon: '💻' },
  //       { value: 'OFFLINE', label: 'Tại nhà', icon: '🏠' },
  //       { value: 'BOTH', label: 'Cả hai hình thức', icon: '🔄' }
  //     ];

  //     const priceRanges = [
  //       { label: 'Dưới 200k', min: 0, max: 200000 },
  //       { label: '200k - 500k', min: 200000, max: 500000 },
  //       { label: '500k - 1M', min: 500000, max: 1000000 },
  //       { label: '1M - 2M', min: 1000000, max: 2000000 },
  //       { label: 'Trên 2M', min: 2000000, max: 10000000 }
  //     ];

  //     const sortOptions = [
  //       { value: 'createdAt', label: 'Mới nhất', icon: '🕒' },
  //       { value: 'pricePerSession', label: 'Giá tiền', icon: '💰' },
  //       { value: 'viewCount', label: 'Lượt xem', icon: '👀' },
  //       { value: 'contactCount', label: 'Lượt liên hệ', icon: '📞' }
  //     ];

  //     // Get available provinces from active tutor posts
  //     const provinces = await TutorPost.aggregate([
  //       { $match: { status: 'ACTIVE' } },
  //       { $lookup: { 
  //         from: 'provinces', 
  //         localField: 'address.province', 
  //         foreignField: '_id', 
  //         as: 'provinceInfo' 
  //       }},
  //       { $unwind: '$provinceInfo' },
  //       { $group: { 
  //         _id: '$provinceInfo._id', 
  //         name: { $first: '$provinceInfo.name' },
  //         code: { $first: '$provinceInfo.code' }
  //       }},
  //       { $sort: { name: 1 }}
  //     ]);

  //     return {
  //       success: true,
  //       message: 'Lấy tùy chọn bộ lọc thành công',
  //       data: {
  //         subjects: subjects,
  //         subjectsByCategory,
  //         studentLevels,
  //         teachingModes,
  //         priceRanges,
  //         sortOptions,
  //         provinces: provinces || []
  //       }
  //     };
  //   } catch (error: any) {
  //     console.error('❌ Get search filter options error:', error);
  //     return {
  //       success: false,
  //       message: error.message || 'Lỗi khi lấy tùy chọn bộ lọc'
  //     };
  //   }
  // }
}