import { Request, Response } from 'express';
import { UserService } from '../../services/user/user.service';
import { ViolationService } from '../../services/violation/violation.service';
import { User } from '../../models/User';
import { UserRole, UserStatus } from '../../types/user.types';

export class AdminUserController {
  /**
   * Get all users with filters and pagination
   * GET /api/v1/admin/users
   */
  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const {
        role,
        status,
        search,
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        sort_order = 'desc',
      } = req.query;

      // Build query
      const query: any = {};

      // Filter by role (exclude ADMIN from list)
      if (role && (role === 'STUDENT' || role === 'TUTOR')) {
        query.role = role;
      } else {
        // By default, only show STUDENT and TUTOR users
        query.role = { $in: [UserRole.STUDENT, UserRole.TUTOR] };
      }

      // Filter by status
      if (status) {
        query.status = status;
      }

      // Search by name or email
      if (search) {
        query.$or = [
          { full_name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone_number: { $regex: search, $options: 'i' } },
        ];
      }

      // Pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Sorting
      const sortField = sort_by as string;
      const sortDirection = sort_order === 'asc' ? 1 : -1;
      const sort: any = { [sortField]: sortDirection };

      // Execute query
      const [users, total] = await Promise.all([
        User.find(query)
          .select(
            '_id full_name email phone_number avatar_url role status created_at updated_at'
          )
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        User.countDocuments(query),
      ]);

      // Get violation counts for all users
      const userIds = users.map((u) => u._id);
      const violationCounts =
        await ViolationService.getBulkViolationCounts(userIds);

      // Merge violation counts with user data
      const usersWithViolations = users.map((user) => ({
        id: user._id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        avatar_url: user.avatar_url,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
        violation_count: violationCounts[user._id] || 0,
      }));

      // Calculate statistics
      const stats = await AdminUserController.getUserStats();

      res.status(200).json({
        success: true,
        data: {
          users: usersWithViolations,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
          },
          stats,
        },
      });
    } catch (error: any) {
      console.error('Error in getAllUsers:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get users',
      });
    }
  }

  /**
   * Get detailed user information
   * GET /api/v1/admin/users/:userId
   */
  static async getUserDetails(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select('-password_hash').lean();

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Get violation summary
      const violationSummary =
        await ViolationService.getUserViolationSummary(userId);

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            ...user,
          },
          violation_summary: violationSummary,
        },
      });
    } catch (error: any) {
      console.error('Error in getUserDetails:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get user details',
      });
    }
  }

  /**
   * Update user status (block/unblock)
   * PATCH /api/v1/admin/users/:userId/status
   */
  static async updateUserStatus(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { status, reason } = req.body;

      // Validate status
      if (!Object.values(UserStatus).includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status value',
        });
        return;
      }

      const user = await User.findById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Prevent blocking admin users
      if (user.role === UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Cannot modify admin user status',
        });
        return;
      }

      const oldStatus = user.status;
      user.status = status;
      await user.save();

      // TODO: Send notification to user about status change
      // TODO: If locked, handle active classes/contracts

      res.status(200).json({
        success: true,
        message: `User status updated from ${oldStatus} to ${status}`,
        data: {
          user: {
            id: user._id,
            full_name: user.full_name,
            email: user.email,
            status: user.status,
          },
          reason,
        },
      });
    } catch (error: any) {
      console.error('Error in updateUserStatus:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update user status',
      });
    }
  }

  /**
   * Get user violation history
   * GET /api/v1/admin/users/:userId/violations
   */
  static async getUserViolations(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      const violations = await ViolationService.getUserViolationHistory(userId);

      res.status(200).json({
        success: true,
        data: violations,
      });
    } catch (error: any) {
      console.error('Error in getUserViolations:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get user violations',
      });
    }
  }

  /**
   * Get user statistics
   * GET /api/v1/admin/users/stats/overview
   */
  static async getUserStats(): Promise<any> {
    try {
      const [
        totalUsers,
        totalStudents,
        totalTutors,
        activeUsers,
        lockedUsers,
        pendingUsers,
      ] = await Promise.all([
        User.countDocuments({
          role: { $in: [UserRole.STUDENT, UserRole.TUTOR] },
        }),
        User.countDocuments({ role: UserRole.STUDENT }),
        User.countDocuments({ role: UserRole.TUTOR }),
        User.countDocuments({
          role: { $in: [UserRole.STUDENT, UserRole.TUTOR] },
          status: UserStatus.ACTIVE,
        }),
        User.countDocuments({
          role: { $in: [UserRole.STUDENT, UserRole.TUTOR] },
          status: UserStatus.LOCKED,
        }),
        User.countDocuments({
          role: { $in: [UserRole.STUDENT, UserRole.TUTOR] },
          status: UserStatus.PENDING_VERIFICATION,
        }),
      ]);

      // Get total violations
      const totalViolations = await ViolationService.getTotalViolationCount();

      return {
        total_users: totalUsers,
        total_students: totalStudents,
        total_tutors: totalTutors,
        active_users: activeUsers,
        locked_users: lockedUsers,
        pending_users: pendingUsers,
        total_violations: totalViolations,
      };
    } catch (error: any) {
      console.error('Error in getUserStats:', error);
      return {
        total_users: 0,
        total_students: 0,
        total_tutors: 0,
        active_users: 0,
        locked_users: 0,
        pending_users: 0,
        total_violations: 0,
      };
    }
  }

  /**
   * Update user information (admin override)
   * PUT /api/v1/admin/users/:userId
   */
  static async updateUserInfo(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const updates = req.body;

      // Remove fields that shouldn't be updated directly
      delete updates.password_hash;
      delete updates._id;
      delete updates.created_at;

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password_hash');

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User information updated successfully',
        data: {
          user: {
            id: user._id,
            ...user.toJSON(),
          },
        },
      });
    } catch (error: any) {
      console.error('Error in updateUserInfo:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update user information',
      });
    }
  }
}
