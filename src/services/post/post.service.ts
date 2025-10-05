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
}