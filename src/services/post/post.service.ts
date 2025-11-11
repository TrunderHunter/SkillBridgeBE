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
import { TutorProfile } from '../../models/TutorProfile';
import { Subject } from '../../models/Subject';
import { mapTutorPostToResponse } from '../../utils/mappers/tutorPost.mapper';
import { v4 as uuidv4, validate as validateUUID } from 'uuid';
import { VerificationRequest } from '../../models/VerificationRequest';
import { logger } from '../../utils/logger';

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
  featured?: boolean;
  subjectId?: string;
}

export interface ITutorSearchPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Interface cho một khoảng thời gian đã được phân tích
interface TimeSlot {
  dayOfWeek: number; // 0 = Chủ nhật, ..., 6 = Thứ bảy
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

// Bảng ánh xạ tên ngày sang chỉ số (index)
const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  'Chủ nhật': 0,
  CN: 0,
  'Thứ hai': 1,
  T2: 1,
  'Thứ ba': 2,
  T3: 2,
  'Thứ tư': 3,
  T4: 3,
  'Thứ năm': 4,
  T5: 4,
  'Thứ sáu': 5,
  T6: 5,
  'Thứ bảy': 6,
  T7: 6,
};

/**
 * Hàm phụ trợ để phân tích chuỗi availability thành một mảng các TimeSlot.
 * @param availabilityString - Ví dụ: "Thứ hai (08:00 - 10:00), Thứ tư (14:00 - 16:00)"
 * @returns Mảng các đối tượng TimeSlot
 */
function parseAvailabilityString(availabilityString: string): TimeSlot[] {
  if (!availabilityString) return [];

  const slots: TimeSlot[] = [];
  // Tách các ngày, đảm bảo không tách sai ở dấu phẩy trong tên
  const dayParts = availabilityString.split(/,\s*(?=[^)]+\()/);

  dayParts.forEach((part) => {
    const dayMatch = part.match(/^(.*?)\s*\((.*?)\)/);
    if (!dayMatch) return;

    const dayName = dayMatch[1].trim();
    const timesStr = dayMatch[2];

    // Tìm key trong map khớp với tên ngày
    const dayKey = Object.keys(DAYS_OF_WEEK_MAP).find((key) =>
      dayName.includes(key)
    );
    if (dayKey === undefined) return;

    const dayIndex = DAYS_OF_WEEK_MAP[dayKey];

    // Tìm tất cả các khoảng thời gian trong ngoặc
    const timeMatches = timesStr.matchAll(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/g);
    for (const match of timeMatches) {
      slots.push({
        dayOfWeek: dayIndex,
        startTime: match[1],
        endTime: match[2],
      });
    }
  });

  return slots;
}

export class PostService {
  /**
   * [HÀM MỚI] Kiểm tra xung đột lịch học cho một sinh viên.
   * @param userId - ID của sinh viên
   * @param newAvailability - Chuỗi lịch học của bài đăng mới
   * @param excludePostId - (Tùy chọn) ID của bài đăng cần loại trừ khi kiểm tra (dùng cho chức năng cập nhật)
   * @returns Object chứa thông tin về việc có trùng lặp hay không.
   */
  static async checkScheduleConflict(
    userId: string,
    newAvailability: string,
    excludePostId?: string
  ): Promise<{ hasConflict: boolean; conflictingPostTitle?: string }> {
    try {
      // 1. Xây dựng query để lấy tất cả bài đăng đang hoạt động của sinh viên
      const query: any = {
        author_id: userId,
        status: { $in: [PostStatus.PENDING, PostStatus.APPROVED] },
      };

      // Nếu đang cập nhật, loại trừ chính bài đăng đó ra khỏi việc kiểm tra
      if (excludePostId) {
        query._id = { $ne: excludePostId };
      }

      const existingActivePosts = await Post.find(query)
        .select('title availability')
        .lean();

      if (existingActivePosts.length === 0) {
        return { hasConflict: false };
      }

      // 2. Phân tích chuỗi availability của bài đăng mới thành các TimeSlot
      const newSlots = parseAvailabilityString(newAvailability);
      if (newSlots.length === 0) {
        return { hasConflict: false }; // Không có lịch để kiểm tra
      }

      // 3. Lặp qua từng bài đăng cũ để kiểm tra
      for (const post of existingActivePosts) {
        if (!post.availability) continue;
        const existingSlots = parseAvailabilityString(post.availability);

        // 4. So sánh từng slot mới với từng slot cũ
        for (const newSlot of newSlots) {
          for (const existingSlot of existingSlots) {
            // Chỉ so sánh nếu cùng ngày trong tuần
            if (newSlot.dayOfWeek === existingSlot.dayOfWeek) {
              // Logic kiểm tra chồng chéo thời gian: (StartA < EndB) and (EndA > StartB)
              const startsBeforeEnd = newSlot.startTime < existingSlot.endTime;
              const endsAfterStart = newSlot.endTime > existingSlot.startTime;

              if (startsBeforeEnd && endsAfterStart) {
                // Tìm thấy trùng lặp!
                return {
                  hasConflict: true,
                  conflictingPostTitle: post.title,
                };
              }
            }
          }
        }
      }

      // Nếu không tìm thấy trùng lặp nào
      return { hasConflict: false };
    } catch (error) {
      console.error('Lỗi khi kiểm tra trùng lịch học:', error);
      // Mặc định không chặn nếu có lỗi xảy ra để tránh trường hợp người dùng không thể đăng bài
      return { hasConflict: false };
    }
  }

  // ✅ ADD: Get verified tutor IDs
  private static async getVerifiedTutorIds(): Promise<string[]> {
    try {
      const verifiedRequests = await VerificationRequest.find({
        status: 'APPROVED',
      })
        .select('user_id')
        .lean();

      return verifiedRequests
        .filter((req) => req && req.tutorId) // << SỬA Ở ĐÂY (Kiểm tra sự tồn tại của trường)
        .map((req) => req.tutorId.toString());
    } catch (error) {
      console.error('Error getting verified tutor IDs:', error);
      return [];
    }
  }

  // ✅ ADD: Enhance tutor info
  private static async enhanceTutorInfo(tutorPost: any): Promise<any> {
    try {
      // Nếu đã có đầy đủ thông tin từ populate, return luôn
      if (
        tutorPost.tutorId &&
        typeof tutorPost.tutorId === 'object' &&
        tutorPost.tutorId.full_name
      ) {
        return tutorPost;
      }

      // Nếu chưa có, fetch thêm thông tin
      const tutorInfo = await User.findById(tutorPost.tutorId)
        .select(
          'full_name email gender date_of_birth avatar_url structured_address profile education achievements certificates role'
        )
        .lean();

      return {
        ...tutorPost,
        tutorId: tutorInfo || tutorPost.tutorId,
      };
    } catch (error) {
      console.error('Error enhancing tutor info:', error);
      return tutorPost;
    }
  }

  // Tạo bài đăng mới
  static async createPost(userId: string, postData: IPostInput): Promise<any> {
    try {
      // [THÊM] Gọi hàm kiểm tra trước khi tạo
      const conflictCheck = await this.checkScheduleConflict(
        userId,
        postData.availability || ''
      );
      if (conflictCheck.hasConflict) {
        return {
          success: false,
          message: `Lịch học bị trùng với bài đăng đã có: "${conflictCheck.conflictingPostTitle}"`,
          isConflict: true, // Thêm cờ để controller biết đây là lỗi trùng lịch
        };
      }

      const post = await Post.create({ ...postData, author_id: userId });
      await post.populate({ path: 'author_id', select: 'full_name avatar' });

      // Notify all admins about new post
      await this.notifyAdminsNewPost(post);

      return {
        success: true,
        message: 'Đăng bài thành công, đang chờ duyệt',
        data: mapPostToResponse(post.toObject()),
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Lỗi khi tạo bài đăng',
      };
    }
  }

  // Helper to notify admins about new post
  private static async notifyAdminsNewPost(post: any): Promise<void> {
    try {
      const NotificationService = (
        await import('../notification/notification.service')
      ).default;

      // Get all admin users
      const admins = await User.find({
        role: 'ADMIN',
        status: 'ACTIVE',
      }).select('_id');

      // Send notification to each admin
      const notifications = admins.map((admin: any) =>
        NotificationService.sendNotification({
          type: 'socket',
          userId: admin._id.toString(),
          notificationType: 'SYSTEM',
          title: 'Bài đăng mới cần duyệt',
          message: `${(post.author_id as any).full_name} đã tạo bài đăng "${post.title}"`,
          priority: 'high',
          actionUrl: `/admin/posts/${post._id}`,
          data: {
            postId: post._id,
            postTitle: post.title,
            authorName: (post.author_id as any).full_name,
          },
        })
      );

      await Promise.allSettled(notifications);
    } catch (error) {
      logger.error('Failed to notify admins about new post:', error);
      // Don't throw - notification failure shouldn't block post creation
    }
  }

  // Lấy danh sách bài đăng với bộ lọc và phân trang
  static async getPosts(
    filterOptions: IPostFilterOptions = {},
    paginationOptions: IPostPaginationOptions = {}
  ): Promise<any> {
    try {
      const {
        status,
        subjects,
        grade_levels,
        is_online,
        author_id,
        search_term,
      } = filterOptions;
      const {
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        sort_order = 'desc',
      } = paginationOptions;

      // Xây dựng query
      const query: any = {};

      // Áp dụng các bộ lọc
      if (status) query.status = status;
      if (subjects && subjects.length > 0) query.subjects = { $in: subjects };
      if (grade_levels && grade_levels.length > 0)
        query.grade_levels = { $in: grade_levels };
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
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách bài đăng',
      };
    }
  }

  /**
   * Lấy danh sách bài đăng của học viên đã được ADMIN phê duyệt dành riêng cho gia sư.
   * Chỉ trả về PostType.STUDENT_REQUEST với trạng thái APPROVED và chưa hết hạn (expiry_date >= now hoặc không có).
   * Luôn ép buộc bộ lọc status/type cho use case của gia sư.
   */
  static async getApprovedStudentPostsForTutor(
    filterOptions: Omit<IPostFilterOptions, 'status'> & { __relax?: boolean } = {},
    paginationOptions: IPostPaginationOptions = {}
  ): Promise<any> {
    try {
      const {
        subjects,
        grade_levels,
        is_online,
        author_id,
        search_term,
        min_hourly_rate,
        max_hourly_rate,
        __relax,
      } = filterOptions as any;
      const {
        page = 1,
        limit = 10,
        sort_by = 'created_at',
        sort_order = 'desc',
      } = paginationOptions;

      const query: any = {
        status: PostStatus.APPROVED,
        type: PostType.STUDENT_REQUEST,
        $or: [
          { expiry_date: { $exists: false } },
          { expiry_date: { $gte: new Date() } },
        ],
      };

      // Apply filters only if not relaxed
      if (!__relax) {
        if (subjects && subjects.length > 0) query.subjects = { $in: subjects };
        if (grade_levels && grade_levels.length > 0)
          query.grade_levels = { $in: grade_levels };
        if (is_online !== undefined) query.is_online = is_online;
        if (author_id) query.author_id = author_id; // Trường hợp cần xem bài của một học viên cụ thể
        if (search_term) {
          query.$or = [
            { title: { $regex: search_term, $options: 'i' } },
            { content: { $regex: search_term, $options: 'i' } },
          ];
        }

        // Lọc theo khoảng học phí (range overlap logic)
        if (min_hourly_rate !== undefined && !isNaN(min_hourly_rate)) {
          query['hourly_rate.max'] = { $gte: Number(min_hourly_rate) };
        }
        if (max_hourly_rate !== undefined && !isNaN(max_hourly_rate)) {
          query['hourly_rate.min'] = { $lte: Number(max_hourly_rate) };
        }
      }

      const sortDirection = sort_order === 'asc' ? 1 : -1;
      const sortOptions: any = { [sort_by]: sortDirection };
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

      // Service-level logging
      console.log('[PostService.getApprovedStudentPostsForTutor] query:', {
        __relax: !!__relax,
        subjects,
        grade_levels,
        is_online,
        search_term,
        min_hourly_rate,
        max_hourly_rate,
        page,
        limit,
      }, 'resultCount:', totalCount);

      return {
        success: true,
        message: 'Lấy danh sách bài đăng học viên đã phê duyệt thành công',
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
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách bài đăng đã phê duyệt',
      };
    }
  }

  // Lấy chi tiết bài đăng theo ID
  static async getPostById(postId: string): Promise<any> {
    try {
      const post = await Post.findById(postId)
        .populate('author_id', 'full_name avatar')
        .lean();

      if (!post) {
        return { success: false, message: 'Không tìm thấy bài đăng' };
      }

      return {
        success: true,
        message: 'Lấy chi tiết bài đăng thành công',
        data: mapPostToResponse(post),
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy chi tiết bài đăng',
      };
    }
  }

  // Cập nhật bài đăng
  static async updatePost(
    postId: string,
    userId: string,
    updateData: IPostUpdateInput
  ): Promise<any> {
    try {
      // [THÊM] Gọi hàm kiểm tra trước khi cập nhật, loại trừ chính bài đăng này
      if (updateData.availability) {
        const conflictCheck = await this.checkScheduleConflict(
          userId,
          updateData.availability,
          postId
        );
        if (conflictCheck.hasConflict) {
          return {
            success: false,
            message: `Lịch học bị trùng với bài đăng đã có: "${conflictCheck.conflictingPostTitle}"`,
            isConflict: true,
          };
        }
      }
      const post = await Post.findById(postId);

      if (!post) {
        return { success: false, message: 'Không tìm thấy bài đăng' };
      }

      // Kiểm tra quyền sở hữu
      if (post.author_id.toString() !== userId) {
        return {
          success: false,
          message: 'Bạn không có quyền cập nhật bài đăng này',
        };
      }

      // Chỉ cho phép cập nhật khi bài đăng đang ở trạng thái PENDING hoặc REJECTED
      if (
        ![PostStatus.PENDING, PostStatus.REJECTED].includes(
          post.status as PostStatus
        )
      ) {
        return {
          success: false,
          message:
            'Chỉ có thể cập nhật bài đăng đang chờ duyệt hoặc bị từ chối',
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
        data: mapPostToResponse(post.toObject()),
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Lỗi khi cập nhật bài đăng',
      };
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

      if (
        post.author_id.toString() !== userId &&
        user.role !== UserRole.ADMIN
      ) {
        return {
          success: false,
          message: 'Bạn không có quyền xóa bài đăng này',
        };
      }

      await Post.findByIdAndDelete(postId);

      return { success: true, message: 'Xóa bài đăng thành công' };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Lỗi khi xóa bài đăng',
      };
    }
  }

  // Admin duyệt bài đăng
  static async reviewPost(
    postId: string,
    adminId: string,
    reviewData: IPostReviewInput
  ): Promise<any> {
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
      return {
        success: false,
        message: error.message || 'Lỗi khi duyệt bài đăng',
      };
    }
  }

  // Tìm gia sư thông minh dựa trên bài đăng của học viên
  static async smartSearchTutors(
    studentPostId: string,
    paginationOptions: IPostPaginationOptions = {}
  ): Promise<any> {
    try {
      const {
        page = 1,
        limit = 12,
        sort_by = 'compatibility',
        sort_order = 'desc',
      } = paginationOptions;

      const studentPost = await Post.findById(studentPostId).lean();
      if (!studentPost) {
        return {
          success: false,
          message: 'Không tìm thấy bài đăng của học viên',
        };
      }

      // Lấy tất cả tutor posts active, populate cần thiết
      const tutorPosts = await TutorPost.find({ status: 'ACTIVE' })
        .populate('subjects', 'name category')
        .populate(
          'tutorId',
          'full_name email gender date_of_birth avatar_url structured_address'
        )
        .populate('address.province address.district address.ward', 'name')
        .lean();

      // Tính score
      const scoredPosts = tutorPosts.map((tp) => ({
        post: tp,
        score: this.calculateCompatibility(studentPost, tp),
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
          tutors: paginated.map((p) => ({
            ...p.post,
            compatibility: Math.round(p.score),
          })),
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Lỗi khi tìm kiếm gia sư thông minh',
      };
    }
  }

  // ✅ FIX: Smart search with filters - REMOVE DUPLICATE IMPLEMENTATION
  static async smartSearchTutorsWithFilters(
    studentPostId: string,
    searchQuery: ITutorSearchQuery = {},
    paginationOptions: IPostPaginationOptions = {}
  ): Promise<any> {
    try {
      const {
        page = 1,
        limit = 12,
        sort_by = 'compatibility',
        sort_order = 'desc',
      } = paginationOptions;

      // 1. Lấy thông tin bài đăng của học viên (Giữ nguyên)
      const studentPost = await Post.findById(studentPostId).lean();
      if (!studentPost) {
        return {
          success: false,
          message: 'Không tìm thấy bài đăng của học viên',
        };
      }

      // 2. ✅ SỬA LỖI & TỐI ƯU: Xây dựng bộ lọc chính tại tầng Database
      const baseFilter: any = {
        status: 'ACTIVE', // Chỉ lấy các bài đăng gia sư đang hoạt động
      };

      // 3. ✅ TỐI ƯU: Truy vấn danh sách gia sư tiềm năng đã được lọc trước từ DB
      const potentialTutors = await TutorPost.find(baseFilter)
        .populate('subjects', 'name category')
        .populate({
          path: 'tutorId',
          select:
            'full_name email gender date_of_birth avatar_url structured_address profile education achievements certificates role',
          model: 'User',
        })
        .lean();

      // ✅ LOẠI BỎ: Bước lọc `validTutors` thừa và gây lỗi trong code. Việc lọc đã được DB thực hiện.
      if (potentialTutors.length === 0) {
        return {
          success: true,
          message: '🤖 Không tìm thấy gia sư nào phù hợp với tiêu chí cơ bản.',
          data: {
            tutors: [],
            pagination: { total: 0, page, limit, pages: 0 },
            aiAnalysis: { totalTutorsAnalyzed: 0, totalFound: 0 },
          },
        };
      }

      // 4. Tính toán điểm tương thích cho danh sách đã được lọc
      const scoredTutors = potentialTutors.map((tutorPost) => {
        const compatibility = this.calculateCompatibility(
          studentPost,
          tutorPost
        );
        const matchDetails = this.getDetailedMatchInfo(studentPost, tutorPost);
        return {
          ...tutorPost,
          compatibility: Math.round(compatibility),
          matchDetails,
        };
      });

      // 5. Sắp xếp theo điểm tương thích (Giữ nguyên)
      let sortedTutors = [...scoredTutors];
      sortedTutors.sort((a, b) => {
        const sortDirection = sort_order === 'desc' ? -1 : 1;
        return sortDirection * (b.compatibility - a.compatibility);
      });

      // ✅ 9. APPLY USER FILTERS AFTER SCORING (Optional filtering)
      let filteredTutors = [...sortedTutors];

      if (searchQuery.subjects && searchQuery.subjects.length > 0) {
        filteredTutors = filteredTutors.filter((tutor) =>
          tutor.subjects.some(
            (subject: any) =>
              searchQuery.subjects!.includes(subject._id.toString()) ||
              searchQuery.subjects!.includes(subject.name)
          )
        );
      }

      if (searchQuery.teachingMode && searchQuery.teachingMode !== 'BOTH') {
        filteredTutors = filteredTutors.filter(
          (tutor) =>
            tutor.teachingMode === searchQuery.teachingMode ||
            tutor.teachingMode === 'BOTH'
        );
      }

      if (searchQuery.studentLevel && searchQuery.studentLevel.length > 0) {
        filteredTutors = filteredTutors.filter((tutor) =>
          searchQuery.studentLevel!.some((level) =>
            tutor.studentLevel.includes(level)
          )
        );
      }

      if (
        searchQuery.priceMin !== undefined ||
        searchQuery.priceMax !== undefined
      ) {
        filteredTutors = filteredTutors.filter((tutor) => {
          if (
            searchQuery.priceMin !== undefined &&
            tutor.pricePerSession < searchQuery.priceMin
          )
            return false;
          if (
            searchQuery.priceMax !== undefined &&
            tutor.pricePerSession > searchQuery.priceMax
          )
            return false;
          return true;
        });
      }

      if (searchQuery.search && searchQuery.search.trim()) {
        const searchTerm = searchQuery.search.trim().toLowerCase();
        filteredTutors = filteredTutors.filter(
          (tutor) =>
            tutor.title?.toLowerCase().includes(searchTerm) ||
            tutor.description?.toLowerCase().includes(searchTerm) ||
            (typeof tutor.tutorId === 'object' &&
              tutor.tutorId &&
              'full_name' in tutor.tutorId &&
              (tutor.tutorId as any).full_name
                ?.toLowerCase()
                .includes(searchTerm)) ||
            tutor.subjects?.some((subject: any) =>
              subject.name?.toLowerCase().includes(searchTerm)
            )
        );
      }

      // ✅ 10. PAGINATION
      const totalCount = filteredTutors.length;
      const totalPages = Math.ceil(totalCount / limit);
      const skip = (page - 1) * limit;
      const paginatedTutors = filteredTutors.slice(skip, skip + limit);

      const pagination = {
        total: totalCount,
        totalItems: totalCount,
        page: page,
        currentPage: page,
        limit: limit,
        pages: totalPages,
        totalPages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      // ✅ 11. BUILD RESPONSE
      const averageCompatibility =
        paginatedTutors.length > 0
          ? Math.round(
            paginatedTutors.reduce((sum, t) => sum + t.compatibility, 0) /
            paginatedTutors.length
          )
          : 0;

      return {
        success: true,
        message: `🤖 AI phân tích ${potentialTutors.length} gia sư, tìm thấy ${totalCount} phù hợp.`,
        data: {
          tutors: paginatedTutors,
          pagination,
          aiAnalysis: {
            studentPostAnalyzed: {
              subjects: studentPost.subjects,
              gradeLevels: studentPost.grade_levels,
              isOnline: studentPost.is_online,
              priceRange: studentPost.hourly_rate,
            },
            filtersApplied: Object.keys(searchQuery).filter(
              (key) =>
                searchQuery[key as keyof ITutorSearchQuery] !== undefined &&
                !['page', 'limit', 'sortBy', 'sortOrder'].includes(key)
            ),
            totalTutorsAnalyzed: potentialTutors.length,
            totalFound: totalCount,
            averageCompatibility,
            sortedBy: 'AI Compatibility Score',
          },
        },
      };
    } catch (error: any) {
      console.error('❌ Smart Search Error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi tìm kiếm gia sư thông minh',
      };
    }
  }

  /**
   * Smart search student posts for a given tutor post (tutor-side smart matching)
   * Hybrid: DB filters from tutor post + compatibility scoring
   */
  static async smartSearchStudentPostsForTutor(
    tutorPostId: string,
    filterOptions: Partial<IPostFilterOptions> = {},
    paginationOptions: IPostPaginationOptions = {}
  ): Promise<any> {
    try {
      const {
        page = 1,
        limit = 20,
        sort_by = 'compatibility',
        sort_order = 'desc',
      } = paginationOptions;

      // 1) Load tutor post context
      const tutorPost = await TutorPost.findById(tutorPostId)
        .populate('subjects', 'name')
        .lean();
      if (!tutorPost) {
        return { success: false, message: 'Không tìm thấy bài đăng gia sư' };
      }

      // Log incoming filter options briefly
      console.log('[PostService.smartSearchStudentPostsForTutor] tutorPostId:', tutorPostId, {
        filterOptions,
        paginationOptions,
      });

      // 2) Build base query of student posts
      const baseQuery: any = {
        status: PostStatus.APPROVED,
        type: PostType.STUDENT_REQUEST,
        $or: [{ expiry_date: { $exists: false } }, { expiry_date: { $gte: new Date() } }],
      };

      // 3) Apply structured matching filters from tutorPost
      if (tutorPost.subjects?.length) {
        const subjectNames = tutorPost.subjects.map((s: any) => (s.name ? s.name : s.toString()));
        baseQuery.subjects = { $in: subjectNames };
      }
      if (tutorPost.studentLevel?.length) {
        baseQuery.grade_levels = { $in: tutorPost.studentLevel };
      }

      // teachingMode vs is_online
      if (tutorPost.teachingMode) {
        if (tutorPost.teachingMode === 'ONLINE') baseQuery.is_online = true;
        else if (tutorPost.teachingMode === 'OFFLINE') baseQuery.is_online = false;
        // BOTH -> no constraint
      }

      // Price overlap: student hourly_rate range overlaps tutor pricePerSession
      if (typeof tutorPost.pricePerSession === 'number') {
        baseQuery.$and = [
          { 'hourly_rate.min': { $lte: tutorPost.pricePerSession } },
          { 'hourly_rate.max': { $gte: tutorPost.pricePerSession } },
        ];
      }

      // 4) Apply user-provided optional filters
      if (filterOptions.subjects && filterOptions.subjects.length) {
        baseQuery.subjects = { $in: filterOptions.subjects };
      }
      if (filterOptions.grade_levels && filterOptions.grade_levels.length) {
        baseQuery.grade_levels = { $in: filterOptions.grade_levels };
      }
      if (filterOptions.is_online !== undefined) {
        baseQuery.is_online = filterOptions.is_online;
      }
      if (filterOptions.search_term) {
        const term = filterOptions.search_term;
        baseQuery.$or = [
          { title: { $regex: term, $options: 'i' } },
          { content: { $regex: term, $options: 'i' } },
        ];
      }
      if ((filterOptions as any).min_hourly_rate !== undefined) {
        baseQuery['hourly_rate.max'] = { $gte: Number((filterOptions as any).min_hourly_rate) };
      }
      if ((filterOptions as any).max_hourly_rate !== undefined) {
        baseQuery['hourly_rate.min'] = { $lte: Number((filterOptions as any).max_hourly_rate) };
      }

      // 5) Fetch candidates
      let candidates = await Post.find(baseQuery)
        .populate('author_id', 'full_name avatar')
        .sort({ created_at: -1 })
        .lean();

      // 5.1) Fallback: If no candidates due to strict constraints (subjects/levels/price overlap),
      // relax constraints step-by-step to still provide useful recommendations.
      if (!candidates.length) {
        console.log('[PostService.smartSearchStudentPostsForTutor] No candidates with strict filters. Applying relaxed query...');
        const relaxedQuery: any = {
          status: PostStatus.APPROVED,
          type: PostType.STUDENT_REQUEST,
          $or: [{ expiry_date: { $exists: false } }, { expiry_date: { $gte: new Date() } }],
        };

        // Keep user-provided optional filters first
        if (filterOptions.subjects && (filterOptions.subjects as any).length) {
          relaxedQuery.subjects = { $in: filterOptions.subjects };
        }
        if (filterOptions.grade_levels && (filterOptions.grade_levels as any).length) {
          relaxedQuery.grade_levels = { $in: filterOptions.grade_levels };
        }
        if (filterOptions.is_online !== undefined) {
          relaxedQuery.is_online = filterOptions.is_online;
        }
        if (filterOptions.search_term) {
          const term = filterOptions.search_term;
          relaxedQuery.$or = [
            { title: { $regex: term, $options: 'i' } },
            { content: { $regex: term, $options: 'i' } },
          ];
        }
        if ((filterOptions as any).min_hourly_rate !== undefined) {
          relaxedQuery['hourly_rate.max'] = { $gte: Number((filterOptions as any).min_hourly_rate) };
        }
        if ((filterOptions as any).max_hourly_rate !== undefined) {
          relaxedQuery['hourly_rate.min'] = { $lte: Number((filterOptions as any).max_hourly_rate) };
        }

        // Note: intentionally NOT forcing subject/level from tutor post or price overlap here.
        candidates = await Post.find(relaxedQuery)
          .populate('author_id', 'full_name avatar')
          .sort({ created_at: -1 })
          .lean();
      }

      console.log('[PostService.smartSearchStudentPostsForTutor] candidates found:', candidates.length);

      // 6) Score compatibility (reuse calculateCompatibility by swapping args)
      const scored = candidates.map((studentPost: any) => {
        // Use existing compatibility function in reverse perspective by adapting tutorPost to expected param
        const compatibility = this.calculateCompatibility(studentPost, tutorPost as any);
        const details = {
          // mirror fields similar to getDetailedMatchInfo
          subjectMatch: studentPost.subjects?.some((s: string) =>
            (tutorPost.subjects || []).some((ts: any) => (ts.name || ts).toString() === s)
          )
            ? 100
            : 0,
          levelMatch: studentPost.grade_levels?.some((g: string) =>
            (tutorPost.studentLevel || []).includes(g)
          )
            ? 100
            : 0,
          priceMatch:
            studentPost.hourly_rate &&
              typeof tutorPost.pricePerSession === 'number' &&
              tutorPost.pricePerSession >= (studentPost.hourly_rate.min ?? 0) &&
              tutorPost.pricePerSession <= (studentPost.hourly_rate.max ?? Number.MAX_SAFE_INTEGER)
              ? 100
              : 0,
          modeMatch:
            tutorPost.teachingMode === 'BOTH' ||
              (studentPost.is_online && tutorPost.teachingMode === 'ONLINE') ||
              (!studentPost.is_online && tutorPost.teachingMode === 'OFFLINE')
              ? 100
              : 30,
        };
        return {
          ...mapPostToResponse(studentPost),
          compatibility: Math.round(compatibility),
          matchDetails: details,
        };
      });

      // 7) Sort by compatibility or created_at
      let sorted = [...scored];
      if (sort_by === 'compatibility') {
        sorted.sort((a, b) =>
          sort_order === 'asc' ? a.compatibility - b.compatibility : b.compatibility - a.compatibility
        );
      } else {
        sorted.sort((a: any, b: any) => {
          const dir = sort_order === 'asc' ? 1 : -1;
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
      }

      // 8) Paginate
      const total = sorted.length;
      const skip = (page - 1) * limit;
      const pageItems = sorted.slice(skip, skip + limit);

      return {
        success: true,
        message: 'Tìm kiếm bài đăng học viên phù hợp thành công',
        data: {
          posts: pageItems,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
          },
          aiAnalysis: {
            tutorPostAnalyzed: {
              subjects: (tutorPost.subjects || []).map((s: any) => s.name || s),
              studentLevels: tutorPost.studentLevel,
              teachingMode: tutorPost.teachingMode,
              pricePerSession: tutorPost.pricePerSession,
            },
            totalStudentPostsAnalyzed: candidates.length,
            totalFound: total,
            averageCompatibility:
              pageItems.length > 0
                ? Math.round(
                  pageItems.reduce((sum: number, p: any) => sum + (p.compatibility || 0), 0) /
                  pageItems.length
                )
                : 0,
          },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Lỗi khi tìm kiếm bài đăng học viên thông minh',
      };
    }
  }
  // ✅ ADD: Search Tutors (Regular Search)
  static async searchTutors(searchQuery: ITutorSearchQuery): Promise<any> {
    try {
      const {
        page = 1,
        limit = 12,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = searchQuery;
      // Build base query
      const baseFilter: any = { status: 'ACTIVE' };

      // Apply filters
      if (searchQuery.subjects && searchQuery.subjects.length > 0) {
        baseFilter.subjects = { $in: searchQuery.subjects };
      }

      if (searchQuery.teachingMode && searchQuery.teachingMode !== 'BOTH') {
        baseFilter.teachingMode = { $in: [searchQuery.teachingMode, 'BOTH'] };
      }

      if (searchQuery.studentLevel && searchQuery.studentLevel.length > 0) {
        baseFilter.studentLevel = { $in: searchQuery.studentLevel };
      }

      if (
        searchQuery.priceMin !== undefined ||
        searchQuery.priceMax !== undefined
      ) {
        baseFilter.pricePerSession = {};
        if (searchQuery.priceMin !== undefined) {
          baseFilter.pricePerSession.$gte = searchQuery.priceMin;
        }
        if (searchQuery.priceMax !== undefined) {
          baseFilter.pricePerSession.$lte = searchQuery.priceMax;
        }
      }

      // Text search
      if (searchQuery.search && searchQuery.search.trim()) {
        const searchTerm = searchQuery.search.trim();
        baseFilter.$or = [
          { title: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
        ];
      }

      // Sorting
      const sortOptions: any = {};
      const sortField = sortBy || 'createdAt';
      const sortDir = sortOrder === 'asc' ? 1 : -1;
      sortOptions[sortField] = sortDir;

      // Execute query
      const skip = (page - 1) * limit;

      const [tutorPosts, totalCount] = await Promise.all([
        TutorPost.find(baseFilter)
          .populate('subjects', 'name category')
          .populate(
            'tutorId',
            'full_name email gender date_of_birth avatar_url'
          )
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        TutorPost.countDocuments(baseFilter),
      ]);

      const pagination = {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1,
      };

      return {
        success: true,
        message: `Tìm thấy ${totalCount} gia sư`,
        data: {
          tutors: tutorPosts.map(mapTutorPostToResponse),
          pagination,
        },
      };
    } catch (error: any) {
      console.error('❌ Search tutors error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi tìm kiếm gia sư',
        error: error,
      };
    }
  }

  // ✅ ADD: Get Featured Tutors
  static async getFeaturedTutors(limit: number = 8): Promise<any> {
    try {
      const tutorPosts = await TutorPost.find({
        status: 'ACTIVE',
        isFeatured: true,
      })
        .populate('subjects', 'name category')
        .populate('tutorId', 'full_name email avatar_url')
        .sort({ viewCount: -1, createdAt: -1 })
        .limit(limit)
        .lean();

      return {
        success: true,
        message: `Lấy ${tutorPosts.length} gia sư nổi bật thành công`,
        data: {
          tutors: tutorPosts.map(mapTutorPostToResponse),
        },
      };
    } catch (error: any) {
      console.error('❌ Get featured tutors error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy gia sư nổi bật',
      };
    }
  }

  // ✅ ADD: Get Tutors by Subject
  static async getTutorsBySubject(
    subjectId: string,
    page: number = 1,
    limit: number = 12
  ): Promise<any> {
    try {
      const skip = (page - 1) * limit;
      const [tutorPosts, totalCount] = await Promise.all([
        TutorPost.find({
          status: 'ACTIVE',
          subjects: subjectId,
        })
          .populate('subjects', 'name category')
          .populate('tutorId', 'full_name email avatar_url')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        TutorPost.countDocuments({
          status: 'ACTIVE',
          subjects: subjectId,
        }),
      ]);

      const pagination = {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1,
      };

      return {
        success: true,
        message: `Tìm thấy ${totalCount} gia sư cho môn học này`,
        data: {
          tutors: tutorPosts.map(mapTutorPostToResponse),
          pagination,
        },
      };
    } catch (error: any) {
      console.error('❌ Get tutors by subject error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy gia sư theo môn học',
      };
    }
  }

  // ✅ ADD: Get Tutors by Location
  static async getTutorsByLocation(
    province?: string,
    district?: string,
    page: number = 1,
    limit: number = 12
  ): Promise<any> {
    try {
      const locationFilter: any = { status: 'ACTIVE' };

      if (province) {
        locationFilter['address.province'] = province;
      }
      if (district) {
        locationFilter['address.district'] = district;
      }

      const skip = (page - 1) * limit;

      const [tutorPosts, totalCount] = await Promise.all([
        TutorPost.find(locationFilter)
          .populate('subjects', 'name category')
          .populate('tutorId', 'full_name email avatar_url')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        TutorPost.countDocuments(locationFilter),
      ]);

      const pagination = {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1,
      };

      return {
        success: true,
        message: `Tìm thấy ${totalCount} gia sư trong khu vực`,
        data: {
          tutors: tutorPosts.map(mapTutorPostToResponse),
          pagination,
        },
      };
    } catch (error: any) {
      console.error('❌ Get tutors by location error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy gia sư theo khu vực',
      };
    }
  }

  // ✅ ADD: Get Tutor by ID
  static async getTutorById(tutorPostId: string): Promise<any> {
    try {
      const tutorPost = await TutorPost.findById(tutorPostId)
        .populate('subjects', 'name category description')
        .populate({
          path: 'tutorId',
          select:
            'full_name email phone gender date_of_birth avatar_url profile education achievements certificates',
          populate: [
            { path: 'education', model: 'Education' },
            { path: 'achievements', model: 'Achievement' },
            { path: 'certificates', model: 'Certificate' },
          ],
        })
        .lean();

      if (!tutorPost) {
        return {
          success: false,
          message: 'Không tìm thấy gia sư',
        };
      }

      // Increment view count
      await TutorPost.findByIdAndUpdate(tutorPostId, {
        $inc: { viewCount: 1 },
      });

      return {
        success: true,
        message: 'Lấy thông tin gia sư thành công',
        data: mapTutorPostToResponse(tutorPost),
      };
    } catch (error: any) {
      console.error('❌ Get tutor by ID error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy thông tin gia sư',
      };
    }
  }

  // ✅ ADD: Contact Tutor
  static async contactTutor(tutorPostId: string): Promise<any> {
    try {
      const tutorPost = await TutorPost.findById(tutorPostId);

      if (!tutorPost) {
        return {
          success: false,
          message: 'Không tìm thấy gia sư',
        };
      }

      // Increment contact count
      await TutorPost.findByIdAndUpdate(tutorPostId, {
        $inc: { contactCount: 1 },
      });

      return {
        success: true,
        message: 'Đã ghi nhận liên hệ với gia sư',
        data: {
          tutorPostId,
          contactCount: (tutorPost.contactCount || 0) + 1,
        },
      };
    } catch (error: any) {
      console.error('❌ Contact tutor error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi liên hệ gia sư',
      };
    }
  }

  // ✅ ADD: Get Search Filter Options
  static async getSearchFilterOptions(): Promise<any> {
    try {
      const [subjects, studentLevels] = await Promise.all([
        Subject.find({ isActive: true })
          .select('_id name category')
          .sort({ name: 1 })
          .lean(),
        TutorPost.distinct('studentLevel').then((levels) =>
          levels.filter(Boolean)
        ),
      ]);

      return {
        success: true,
        message: 'Lấy tùy chọn bộ lọc thành công',
        data: {
          subjects,
          // provinces,
          studentLevels,
          teachingModes: [
            { value: 'ONLINE', label: 'Dạy online' },
            { value: 'OFFLINE', label: 'Dạy offline' },
            { value: 'BOTH', label: 'Cả hai hình thức' },
          ],
          priceRanges: [
            { min: 0, max: 100000, label: 'Dưới 100k' },
            { min: 100000, max: 300000, label: '100k - 300k' },
            { min: 300000, max: 500000, label: '300k - 500k' },
            { min: 500000, max: 1000000, label: '500k - 1M' },
            { min: 1000000, max: null, label: 'Trên 1M' },
          ],
        },
      };
    } catch (error: any) {
      console.error('❌ Get search filter options error:', error);
      return {
        success: false,
        message: error.message || 'Lỗi khi lấy tùy chọn bộ lọc',
      };
    }
  }

  // ✅ IMPROVE: Calculate Compatibility method
  private static calculateCompatibility(
    studentPost: any,
    tutorPost: any
  ): number {
    let totalScore = 0;
    let maxPossibleScore = 0;
    // 1. Subject matching (40 points)
    maxPossibleScore += 40;
    if (
      studentPost.subjects &&
      studentPost.subjects.length > 0 &&
      tutorPost.subjects
    ) {
      const studentSubjects = Array.isArray(studentPost.subjects)
        ? studentPost.subjects
        : [studentPost.subjects];
      const tutorSubjects = tutorPost.subjects.map(
        (s: any) => s.name || s.toString()
      );

      const matchingSubjects = studentSubjects.filter((subject: string) =>
        tutorSubjects.some(
          (tutorSubject: string) =>
            tutorSubject.toLowerCase().includes(subject.toLowerCase()) ||
            subject.toLowerCase().includes(tutorSubject.toLowerCase())
        )
      );

      const subjectScore =
        studentSubjects.length > 0
          ? (matchingSubjects.length / studentSubjects.length) * 40
          : 20;

      totalScore += subjectScore;
    } else {
      totalScore += 20; // Base score if no subjects specified
    }

    // 2. Grade level matching (25 points)
    maxPossibleScore += 25;
    if (
      studentPost.grade_levels &&
      studentPost.grade_levels.length > 0 &&
      tutorPost.studentLevel
    ) {
      const studentGrades = Array.isArray(studentPost.grade_levels)
        ? studentPost.grade_levels
        : [studentPost.grade_levels];
      const tutorLevels = Array.isArray(tutorPost.studentLevel)
        ? tutorPost.studentLevel
        : [tutorPost.studentLevel];

      const matchingGrades = studentGrades.filter((grade: string) =>
        tutorLevels.some(
          (level: string) =>
            level.toLowerCase().includes(grade.toLowerCase()) ||
            grade.toLowerCase().includes(level.toLowerCase())
        )
      );

      const gradeScore =
        studentGrades.length > 0
          ? (matchingGrades.length / studentGrades.length) * 25
          : 15;

      totalScore += gradeScore;
    } else {
      totalScore += 15; // Base score
    }

    // 3. Teaching mode matching (20 points)
    maxPossibleScore += 20;
    const studentMode = studentPost.is_online ? 'ONLINE' : 'OFFLINE';
    let modeScore = 10; // Base score

    if (tutorPost.teachingMode) {
      if (tutorPost.teachingMode === studentMode) {
        modeScore = 20; // Perfect match
      } else if (tutorPost.teachingMode === 'BOTH') {
        modeScore = 18; // Can teach both modes
      } else {
        modeScore = 8; // Mismatch but still some points
      }
    }

    totalScore += modeScore;
    // 4. Price matching (15 points)
    maxPossibleScore += 15;
    let priceScore = 10; // Base score

    if (
      studentPost.hourly_rate &&
      studentPost.hourly_rate.min !== undefined &&
      studentPost.hourly_rate.max !== undefined &&
      tutorPost.pricePerSession !== undefined
    ) {
      if (
        tutorPost.pricePerSession >= studentPost.hourly_rate.min &&
        tutorPost.pricePerSession <= studentPost.hourly_rate.max
      ) {
        priceScore = 15; // Perfect match - within range
      } else {
        // Calculate based on how far outside the range
        const midPoint =
          (studentPost.hourly_rate.min + studentPost.hourly_rate.max) / 2;
        const difference = Math.abs(tutorPost.pricePerSession - midPoint);
        const maxDifference = Math.max(
          midPoint - studentPost.hourly_rate.min,
          studentPost.hourly_rate.max - midPoint
        );

        if (maxDifference > 0) {
          priceScore = Math.max(5, 15 * (1 - difference / (maxDifference * 2)));
        }
      }
    }
    totalScore += priceScore;
    const finalScore = Math.min(
      100,
      Math.max(20, (totalScore / maxPossibleScore) * 100)
    );
    return finalScore;
  }

  // ✅ ADD: Get Detailed Match Info method
  private static getDetailedMatchInfo(studentPost: any, tutorPost: any) {
    // Subject match percentage
    const subjectMatch =
      studentPost.subjects && studentPost.subjects.length > 0
        ? (studentPost.subjects.filter((s: string) =>
          tutorPost.subjects.some((ts: any) => ts.name === s)
        ).length /
          studentPost.subjects.length) *
        100
        : 100;

    // Grade level match percentage
    const gradeMatch =
      studentPost.grade_levels && studentPost.grade_levels.length > 0
        ? (studentPost.grade_levels.filter((g: string) =>
          tutorPost.studentLevel.includes(g)
        ).length /
          studentPost.grade_levels.length) *
        100
        : 100;

    // Price compatibility
    let priceMatch = 100;
    if (
      studentPost.hourly_rate &&
      studentPost.hourly_rate.min &&
      studentPost.hourly_rate.max
    ) {
      if (
        tutorPost.pricePerSession >= studentPost.hourly_rate.min &&
        tutorPost.pricePerSession <= studentPost.hourly_rate.max
      ) {
        priceMatch = 100;
      } else {
        const midPoint =
          (studentPost.hourly_rate.min + studentPost.hourly_rate.max) / 2;
        const difference = Math.abs(tutorPost.pricePerSession - midPoint);
        const range = studentPost.hourly_rate.max - studentPost.hourly_rate.min;
        priceMatch = Math.max(30, 100 - (difference / range) * 50);
      }
    }

    // Teaching mode compatibility
    const studentMode = studentPost.is_online ? 'ONLINE' : 'OFFLINE';
    let modeMatch = 0;
    if (tutorPost.teachingMode === studentMode) {
      modeMatch = 100;
    } else if (tutorPost.teachingMode === 'BOTH') {
      modeMatch = 90;
    } else {
      modeMatch = 25;
    }

    return {
      subjectMatch: Math.round(subjectMatch),
      gradeMatch: Math.round(gradeMatch),
      priceMatch: Math.round(priceMatch),
      modeMatch: Math.round(modeMatch),
      locationMatch: 85,
      scheduleMatch: 75,
      overallScore: Math.round(
        (subjectMatch + gradeMatch + priceMatch + modeMatch) / 4
      ),
    };
  }
}
