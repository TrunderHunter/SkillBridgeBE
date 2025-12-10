import { Request, Response, NextFunction } from 'express';
import { Payment } from '../../models/Payment';
import { PaymentSchedule } from '../../models/PaymentSchedule';
import { Contract } from '../../models/Contract';

/**
 * Get all payments with filters and pagination (Admin)
 */
export const getAllPayments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentMethod,
      paymentType,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const filter: any = {};

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Payment method filter
    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    // Payment type filter
    if (paymentType) {
      filter.paymentType = paymentType;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate as string);
      }
    }

    // Search by orderId, email, or name
    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { gatewayTransactionId: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('studentId', 'full_name email avatar_url')
        .populate('tutorId', 'full_name email avatar_url')
        .populate('learningClassId', 'title')
        .populate('contractId', 'contract_code')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Payment.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: 'Lấy danh sách giao dịch thành công',
      data: {
        payments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment statistics (Admin)
 */
export const getPaymentStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate as string);
      }
    }

    // Get statistics
    const [
      statusStats,
      paymentMethodStats,
      revenueStats,
      refundStats,
      dailyStats,
    ] = await Promise.all([
      // Status distribution
      Payment.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),

      // Payment method distribution
      Payment.aggregate([
        { $match: { ...dateFilter, status: 'COMPLETED' } },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),

      // Total revenue (completed payments)
      Payment.aggregate([
        { $match: { ...dateFilter, status: 'COMPLETED' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            count: { $sum: 1 },
            averageAmount: { $avg: '$amount' },
          },
        },
      ]),

      // Refund statistics
      Payment.aggregate([
        { $match: { ...dateFilter, status: 'REFUNDED' } },
        {
          $group: {
            _id: null,
            totalRefunded: { $sum: '$refundInfo.amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Daily revenue for last 30 days
      Payment.aggregate([
        {
          $match: {
            status: 'COMPLETED',
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]),
    ]);

    // Calculate success rate
    const totalPayments = statusStats.reduce(
      (acc, stat) => acc + stat.count,
      0
    );
    const completedPayments =
      statusStats.find((s) => s._id === 'COMPLETED')?.count || 0;
    const successRate =
      totalPayments > 0 ? (completedPayments / totalPayments) * 100 : 0;

    res.status(200).json({
      success: true,
      message: 'Lấy thống kê giao dịch thành công',
      data: {
        statusStats,
        paymentMethodStats,
        revenue: {
          total: revenueStats[0]?.totalRevenue || 0,
          count: revenueStats[0]?.count || 0,
          average: revenueStats[0]?.averageAmount || 0,
        },
        refunds: {
          total: refundStats[0]?.totalRefunded || 0,
          count: refundStats[0]?.count || 0,
        },
        successRate: Math.round(successRate * 100) / 100,
        dailyStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment details by ID (Admin)
 */
export const getPaymentDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId)
      .populate('studentId', 'full_name email phone_number avatar_url')
      .populate('tutorId', 'full_name email phone_number avatar_url')
      .populate('learningClassId', 'title description total_sessions')
      .populate('contractId', 'contract_code status total_amount')
      .populate({
        path: 'paymentScheduleId',
        select: 'installments totalAmount paidAmount',
      })
      .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy giao dịch',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Lấy chi tiết giao dịch thành công',
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment by orderId (Admin)
 */
export const getPaymentByOrderId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { orderId } = req.params;

    const payment = await Payment.findOne({ orderId })
      .populate('studentId', 'full_name email phone_number avatar_url')
      .populate('tutorId', 'full_name email phone_number avatar_url')
      .populate('learningClassId', 'title description total_sessions')
      .populate('contractId', 'contract_code status total_amount')
      .populate({
        path: 'paymentScheduleId',
        select: 'installments totalAmount paidAmount',
      })
      .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy giao dịch',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Lấy chi tiết giao dịch thành công',
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export payments to CSV (Admin)
 */
export const exportPayments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, startDate, endDate } = req.query;

    // Build filter
    const filter: any = {};
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }

    const payments = await Payment.find(filter)
      .populate('studentId', 'full_name email')
      .populate('tutorId', 'full_name email')
      .populate('learningClassId', 'title')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      message: 'Xuất dữ liệu thành công',
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};
