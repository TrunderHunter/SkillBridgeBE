import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

/**
 * Middleware kiểm tra người dùng có role student
 */
export const requireStudentRole = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;

    if (!user) {
      return sendError(res, 'Không tìm thấy thông tin xác thực', undefined, 401);
    }

    // Kiểm tra role
    if (user.role.toLowerCase() !== 'student') {
      return sendError(
        res,
        'Bạn không có quyền truy cập chức năng này. Chỉ học viên mới có thể sử dụng.',
        undefined,
        403
      );
    }

    // Kiểm tra trạng thái tài khoản
    if (user.status !== 'active') {
      return sendError(
        res,
        'Tài khoản của bạn chưa được kích hoạt hoặc đã bị khóa',
        undefined,
        403
      );
    }

    next();
  } catch (error) {
    return sendError(
      res,
      'Lỗi xác thực quyền truy cập',
      undefined,
      500
    );
  }
};