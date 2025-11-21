import {
  Contract,
  ContactRequest,
  LearningClass,
  User,
  Subject,
  TutorPost,
} from '../../models';
import {
  CreateContractInput,
  StudentContractResponse,
  ContractFilters,
  ContractSummary,
} from '../../types/contract.types';
import { PaymentService } from './payment.service';
import { NotificationService } from '../notification/notification.service';
import { classService } from '../class/class.service';
import { logger } from '../../utils/logger';

export class ContractService {
  private paymentService: PaymentService;
  private notificationService: NotificationService;
  private classService: typeof classService;

  constructor() {
    this.paymentService = new PaymentService();
    this.notificationService = new NotificationService();
    this.classService = classService;
  }

  async createContract(tutorId: string, contractData: CreateContractInput) {
    try {
      // Verify contact request exists and belongs to tutor
      const contactRequest = await ContactRequest.findOne({
        _id: contractData.contactRequestId,
        tutorId: tutorId,
        status: 'ACCEPTED',
      }).populate('studentId tutorId tutorPostId studentPostId');

      if (!contactRequest) {
        throw new Error('Contact request not found or not accepted');
      }

      // Check if contract already exists for this contact request
      const existingContract = await Contract.findOne({
        contactRequestId: contractData.contactRequestId,
        status: { $nin: ['REJECTED', 'EXPIRED', 'CANCELLED'] },
      });

      if (existingContract) {
        throw new Error('Contract already exists for this contact request');
      }

      // Get pricing from contact request or tutor post
      const pricePerSession =
        contractData.pricePerSession ||
        contactRequest.expectedPrice ||
        (contactRequest.tutorPostId as any)?.pricePerSession;

      if (!pricePerSession) {
        throw new Error('Price per session not specified');
      }

      // Get session duration
      const sessionDuration =
        contractData.sessionDuration || contactRequest.sessionDuration || 90; // Default 90 minutes

      // Calculate expected end date
      const startDate = new Date(contractData.startDate);
      const sessionsPerWeek = contractData.schedule.dayOfWeek.length;
      const totalWeeks = Math.ceil(
        contractData.totalSessions / sessionsPerWeek
      );
      const expectedEndDate = new Date(startDate);
      expectedEndDate.setDate(expectedEndDate.getDate() + totalWeeks * 7);

      // Determine learning mode - prioritize contractData
      const learningMode =
        contractData.learningMode ||
        (contactRequest.learningMode === 'FLEXIBLE'
          ? contractData.location
            ? 'OFFLINE'
            : 'ONLINE'
          : (contactRequest.learningMode as 'ONLINE' | 'OFFLINE'));

      // Get subject from tutorPost if not in contractData
      let subject = contractData.subject;
      if (!subject && contactRequest.tutorPostId) {
        const populatedTutorPost = await contactRequest.populate('tutorPostId');
        const tutorPost = populatedTutorPost.tutorPostId as any;
        // TutorPost has subjects array, take first one
        if (tutorPost?.subjects && tutorPost.subjects.length > 0) {
          subject = tutorPost.subjects[0];
        }
      }

      // Fallback to contactRequest.subject if still not found
      if (!subject && contactRequest.subject) {
        subject = contactRequest.subject;
      }

      if (!subject) {
        logger.warn(
          `No subject found for contract from contact request: ${contractData.contactRequestId}`
        );
      }

      // Extract subject ID if it's an object (populated)
      const subjectId = subject
        ? typeof subject === 'object' && subject !== null
          ? (subject as any)._id?.toString() || (subject as any).id?.toString()
          : subject.toString()
        : undefined;

      // Generate contract code and terms
      const contractCode = `HĐ-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      const contractTerms = this.generateContractTerms(
        contractData,
        contactRequest,
        pricePerSession
      );

      // Create contract with proper type conversion
      const contract = new Contract({
        contactRequestId: contractData.contactRequestId,
        studentId: contactRequest.studentId,
        tutorId: tutorId,
        tutorPostId: contactRequest.tutorPostId,
        studentPostId: contactRequest.studentPostId,

        title: contractCode, // Contract code
        description: contractTerms, // Contract terms

        // Store class info separately for learning class creation
        classTitle: contractData.title, // Class title from frontend
        classDescription: contractData.description, // Class description from frontend
        subject: subjectId, // Add subject ID (not object) to contract
        totalSessions: Number(contractData.totalSessions),
        pricePerSession: Number(pricePerSession),
        totalAmount:
          Number(contractData.totalAmount) ||
          Number(contractData.totalSessions) * Number(pricePerSession),
        sessionDuration: Number(sessionDuration),
        learningMode: learningMode,

        schedule: {
          ...contractData.schedule,
          timezone: 'Asia/Ho_Chi_Minh',
        },

        startDate: startDate,
        expectedEndDate: expectedEndDate,
        location: contractData.location,
        onlineInfo: contractData.onlineInfo,

        status: 'PENDING_STUDENT_APPROVAL',
      });

      await contract.save();

      // Send notification to student
      await NotificationService.sendNotification({
        type: 'socket',
        userId: contactRequest.studentId as string,
        notificationType: 'CONTRACT_CREATED',
        title: 'Hợp đồng mới cần duyệt',
        message: `Gia sư đã tạo hợp đồng cho lớp "${contract.title}". Vui lòng kiểm tra và phê duyệt.`,
        data: {
          contractId: contract._id,
          tutorName: (contactRequest.tutorId as any).full_name,
        },
        actionUrl: `/student/contracts/${contract._id}`,
        priority: 'high',
      });

      // Populate for response
      await contract.populate([
        { path: 'studentId', select: 'full_name email avatar' },
        { path: 'tutorId', select: 'full_name email avatar' },
        { path: 'tutorPostId', select: 'title pricePerSession' },
      ]);

      logger.info(
        `Contract created: ${contract._id} for contact request: ${contractData.contactRequestId}`
      );

      return contract;
    } catch (error: any) {
      logger.error('Error creating contract:', error);
      throw new Error(error.message || 'Failed to create contract');
    }
  }

  private generateContractTerms(
    contractData: any,
    contactRequest: any,
    pricePerSession: number
  ): string {
    return `ĐIỀU KHOẢN HỢP ĐỒNG GIẢNG DẠY

ĐIỀU 1: CÁC BEN THAM GIA
- Bên A (Gia sư): ${(contactRequest.tutorId as any)?.full_name || 'N/A'}
- Bên B (Học viên): ${(contactRequest.studentId as any)?.full_name || 'N/A'}

ĐIỀU 2: NỘI DUNG HỢP ĐỒNG
- Tổng số buổi học: ${contractData.totalSessions} buổi
- Thời lượng mỗi buổi: ${contractData.sessionDuration || 90} phút
- Học phí mỗi buổi: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(pricePerSession)}
- Tổng chi phí: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(contractData.totalSessions * pricePerSession)}

ĐIỀU 3: LỊCH HỌC
- Thời gian: ${contractData.schedule.startTime} - ${contractData.schedule.endTime}
- Các ngày: ${contractData.schedule.dayOfWeek.map((d: number) => ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][d]).join(', ')}
- Hình thức: ${contractData.learningMode === 'ONLINE' ? 'Trực tuyến' : 'Tại nhà'}

ĐIỀU 4: QUYỀN VÀ NGHĨA VỤ
- Gia sư có trách nhiệm giảng dạy đúng lịch, đảm bảo chất lượng
- Học viên có trách nhiệm tham gia đầy đủ, thanh toán đúng hạn
- Cả hai bên có quyền hủy hợp đồng với thông báo trước 48 giờ

ĐIỀU 5: ĐIỀU KHOẢN KHÁC
- Hợp đồng có hiệu lực từ ngày ký kết
- Mọi tranh chấp sẽ được giải quyết thông qua thương lượng
- Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau`;
  }

  async respondToContract(
    contractId: string,
    studentId: string,
    response: StudentContractResponse
  ) {
    try {
      // First, let's check if the contract exists at all
      const existingContract = await Contract.findById(contractId);
      if (!existingContract) {
        throw new Error(`Contract with ID ${contractId} does not exist`);
      }
      const contract = await Contract.findOne({
        _id: contractId,
        studentId: studentId,
        status: 'PENDING_STUDENT_APPROVAL',
      }).populate([{ path: 'tutorId', select: 'full_name email' }]);

      if (!contract) {
        throw new Error(
          `Contract not found or not pending approval. Contract status: ${existingContract.status}, Student ID match: ${existingContract.studentId === studentId}`
        );
      }

      // Check if contract is expired
      if (contract.expiresAt < new Date()) {
        contract.status = 'EXPIRED';
        await contract.save();

        // Notify both tutor and student about expiration
        await Promise.allSettled([
          NotificationService.sendNotification({
            type: 'socket',
            userId: contract.tutorId as string,
            notificationType: 'CONTRACT_EXPIRED',
            title: 'Hợp đồng đã hết hạn',
            message: `Hợp đồng "${contract.title}" đã hết hạn do không được phê duyệt trong thời gian quy định.`,
            data: { contractId: contract._id },
            actionUrl: `/tutor/contracts/${contract._id}`,
            priority: 'normal',
          }),
          NotificationService.sendNotification({
            type: 'socket',
            userId: contract.studentId as string,
            notificationType: 'CONTRACT_EXPIRED',
            title: 'Hợp đồng đã hết hạn',
            message: `Hợp đồng "${contract.title}" đã hết hạn do không được phê duyệt trong thời gian quy định.`,
            data: { contractId: contract._id },
            actionUrl: `/student/contracts/${contract._id}`,
            priority: 'normal',
          }),
        ]);

        throw new Error('Contract has expired');
      }

      // Update contract with student response
      contract.studentResponse = {
        action: response.action,
        respondedAt: new Date(),
        message: response.message,
        requestedChanges: response.requestedChanges,
      };

      if (response.action === 'APPROVE') {
        contract.status = 'APPROVED';
        contract.approvedAt = new Date();

        // DON'T create learning class yet - wait until both parties sign
        // await this.createLearningClassFromContract(contract);

        // Notify tutor
        await NotificationService.sendNotification({
          type: 'socket',
          userId: contract.tutorId as string,
          notificationType: 'CONTRACT_APPROVED',
          title: 'Hợp đồng được phê duyệt',
          message: `Học viên đã phê duyệt hợp đồng "${contract.title}". Cần ký hợp đồng để tạo lớp học.`,
          data: {
            contractId: contract._id,
            studentName: (contract.studentId as any).full_name,
          },
          actionUrl: `/tutor/contracts/${contract._id}`,
          priority: 'high',
        });
      } else if (response.action === 'REJECT') {
        contract.status = 'REJECTED';
        contract.rejectedAt = new Date();

        // Notify tutor
        await NotificationService.sendNotification({
          type: 'socket',
          userId: contract.tutorId as string,
          notificationType: 'CONTRACT_REJECTED',
          title: 'Hợp đồng bị từ chối',
          message: `Học viên đã từ chối hợp đồng "${contract.title}".`,
          data: {
            contractId: contract._id,
            studentName: (contract.studentId as any).full_name,
            reason: response.message,
          },
          actionUrl: `/tutor/contracts/${contract._id}`,
          priority: 'normal',
        });
      } else if (response.action === 'REQUEST_CHANGES') {
        // Keep status as pending, notify tutor about requested changes
        await NotificationService.sendNotification({
          type: 'socket',
          userId: contract.tutorId as string,
          notificationType: 'SYSTEM',
          title: 'Yêu cầu thay đổi hợp đồng',
          message: `Học viên yêu cầu thay đổi hợp đồng "${contract.title}".`,
          data: {
            contractId: contract._id,
            studentName: (contract.studentId as any).full_name,
            requestedChanges: response.requestedChanges,
          },
          priority: 'normal',
        });
      }

      await contract.save();

      return contract;
    } catch (error: any) {
      logger.error('Error responding to contract:', error);
      throw new Error(error.message || 'Failed to respond to contract');
    }
  }

  async getContractById(contractId: string, userId: string) {
    try {
      const contract = await Contract.findOne({
        _id: contractId,
        $or: [{ studentId: userId }, { tutorId: userId }],
      }).populate([
        { path: 'studentId', select: 'full_name email avatar' },
        { path: 'tutorId', select: 'full_name email avatar' },
        { path: 'tutorPostId', select: 'title pricePerSession' },
      ]);

      if (!contract) {
        throw new Error('Contract not found or access denied');
      }

      return contract;
    } catch (error: any) {
      logger.error('Error getting contract:', error);
      throw new Error(error.message || 'Failed to get contract');
    }
  }

  async getContractsByStudent(studentId: string, filters: ContractFilters) {
    try {
      const { status, page = 1, limit = 10 } = filters;
      const skip = (page - 1) * limit;

      const query: any = { studentId };
      if (status) query.status = status;

      const contracts = await Contract.find(query)
        .populate([
          { path: 'tutorId', select: 'full_name email avatar' },
          { path: 'tutorPostId', select: 'title' },
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Contract.countDocuments(query);

      return {
        contracts,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error('Error getting student contracts:', error);
      throw new Error(error.message || 'Failed to get contracts');
    }
  }

  async getContractsByTutor(tutorId: string, filters: ContractFilters) {
    try {
      const { status, page = 1, limit = 10 } = filters;
      const skip = (page - 1) * limit;

      const query: any = { tutorId };
      if (status) query.status = status;

      const contracts = await Contract.find(query)
        .populate([
          { path: 'studentId', select: 'full_name email avatar' },
          { path: 'tutorPostId', select: 'title' },
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Contract.countDocuments(query);

      return {
        contracts,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error('Error getting tutor contracts:', error);
      throw new Error(error.message || 'Failed to get contracts');
    }
  }

  async getPendingContractsForStudent(studentId: string) {
    try {
      const contracts = await Contract.find({
        studentId: studentId,
        status: 'PENDING_STUDENT_APPROVAL',
        expiresAt: { $gt: new Date() },
      })
        .populate([
          { path: 'tutorId', select: 'full_name email avatar' },
          { path: 'tutorPostId', select: 'title' },
          { path: 'subject', select: 'name' },
        ])
        .sort({ createdAt: -1 });

      return contracts;
    } catch (error: any) {
      logger.error('Error getting pending contracts:', error);
      throw new Error(error.message || 'Failed to get pending contracts');
    }
  }

  async cancelContract(contractId: string, userId: string, reason?: string) {
    try {
      const contract = await Contract.findOne({
        _id: contractId,
        $or: [{ studentId: userId }, { tutorId: userId }],
        status: { $in: ['PENDING_STUDENT_APPROVAL', 'APPROVED'] },
      });

      if (!contract) {
        throw new Error('Contract not found or cannot be cancelled');
      }

      contract.status = 'CANCELLED';
      contract.cancelledAt = new Date();
      contract.cancelledBy = userId;
      await contract.save();

      // If learning class exists, cancel it
      const learningClass = await LearningClass.findOne({ contractId });
      if (learningClass) {
        await this.classService.cancelLearningClass(
          learningClass._id,
          userId,
          reason
        );
      }

      // Send notifications to both parties
      const isTutor = contract.tutorId.toString() === userId;
      const targetUserId = isTutor ? contract.studentId : contract.tutorId;
      const cancellerRole = isTutor ? 'gia sư' : 'học viên';

      await NotificationService.sendNotification({
        type: 'socket',
        userId: targetUserId as string,
        notificationType: 'CONTRACT_CANCELLED',
        title: 'Hợp đồng đã bị hủy',
        message: `${cancellerRole} đã hủy hợp đồng "${contract.title}"${reason ? `: ${reason}` : '.'}`,
        data: {
          contractId: contract._id,
          reason: reason,
        },
        actionUrl: isTutor
          ? `/student/contracts/${contract._id}`
          : `/tutor/contracts/${contract._id}`,
        priority: 'high',
      });

      logger.info(`Contract ${contractId} cancelled by user: ${userId}`);

      return contract;
    } catch (error: any) {
      logger.error('Error cancelling contract:', error);
      throw new Error(error.message || 'Failed to cancel contract');
    }
  }

  async getAllContracts(filters: ContractFilters) {
    try {
      const { status, page = 1, limit = 20 } = filters;
      const skip = (page - 1) * limit;

      const query: any = {};
      if (status) query.status = status;

      const contracts = await Contract.find(query)
        .populate([
          { path: 'studentId', select: 'full_name email' },
          { path: 'tutorId', select: 'full_name email' },
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Contract.countDocuments(query);

      return {
        contracts,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error('Error getting all contracts:', error);
      throw new Error(error.message || 'Failed to get contracts');
    }
  }

  async getContractStatistics() {
    try {
      const stats = await Contract.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalValue: { $sum: '$totalAmount' },
          },
        },
      ]);

      const monthlyStats = await Contract.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(
                new Date().getFullYear(),
                new Date().getMonth() - 11,
                1
              ),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            count: { $sum: 1 },
            totalValue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]);

      return {
        statusStats: stats,
        monthlyStats: monthlyStats,
      };
    } catch (error: any) {
      logger.error('Error getting contract statistics:', error);
      throw new Error(error.message || 'Failed to get contract statistics');
    }
  }

  private async createLearningClassFromContract(contract: any) {
    try {
      logger.info(
        `Starting to create learning class from contract: ${contract._id}`
      );

      // Use class service to create learning class from contract
      const learningClass =
        await this.classService.createLearningClassFromContract(contract);

      logger.info(`Learning class created successfully: ${learningClass._id}`);

      // Create payment schedule for the learning class
      logger.info(
        `Creating payment schedule for learning class: ${learningClass._id}`
      );

      try {
        await this.paymentService.createPaymentSchedule({
          contractId: contract._id,
          paymentMethod: 'INSTALLMENTS',
          installmentPlan: {
            numberOfInstallments: contract.totalSessions,
            firstPaymentPercentage: 100 / contract.totalSessions, // Equal payment per session
          },
          paymentTerms: {
            lateFeePercentage: 5,
            gracePeriodDays: 3,
            cancellationPolicy: {
              refundPercentage: 80,
              minimumNoticeDays: 7,
            },
          },
        });

        // Update payment schedule with learning class ID
        await this.paymentService.updatePaymentScheduleWithClass(
          contract._id,
          learningClass._id
        );

        // Activate payment schedule
        await this.paymentService.activatePaymentSchedule(contract._id);

        logger.info(
          `Payment schedule created and activated for contract: ${contract._id}`
        );
      } catch (paymentError: any) {
        logger.error(
          `Error creating payment schedule for contract ${contract._id}:`,
          paymentError
        );
        // Don't fail the entire operation if payment schedule creation fails
        // The payment schedule can be created manually later if needed
      }

      logger.info(`Learning class created from contract: ${contract._id}`);

      return learningClass;
    } catch (error: any) {
      logger.error('Error creating learning class from contract:', error);
      throw error;
    }
  }

  // ============================================
  // CONTRACT SIGNING METHODS (OTP-based e-signature)
  // ============================================

  /**
   * Calculate SHA-256 hash of contract content for integrity verification
   */
  calculateContractHash(contract: any): string {
    const crypto = require('crypto');

    // Create canonical representation of contract data
    const contractData = {
      contactRequestId: contract.contactRequestId,
      studentId: contract.studentId,
      tutorId: contract.tutorId,
      title: contract.title,
      description: contract.description,
      totalSessions: contract.totalSessions,
      pricePerSession: contract.pricePerSession,
      totalAmount: contract.totalAmount,
      sessionDuration: contract.sessionDuration,
      learningMode: contract.learningMode,
      schedule: contract.schedule,
      startDate: contract.startDate?.toISOString(),
      expectedEndDate: contract.expectedEndDate?.toISOString(),
      location: contract.location,
      onlineInfo: contract.onlineInfo,
    };

    const canonicalString = JSON.stringify(
      contractData,
      Object.keys(contractData).sort()
    );
    return crypto.createHash('sha256').update(canonicalString).digest('hex');
  }

  /**
   * Initiate contract signing process
   * - Generates contract hash
   * - Saves original content snapshot
   * - Triggers OTP generation via controller
   */
  async initiateContractSigning(
    contractId: string,
    userId: string,
    role: 'student' | 'tutor'
  ) {
    try {
      const contract = await Contract.findById(contractId)
        .populate('studentId', 'email full_name')
        .populate('tutorId', 'email full_name');

      if (!contract) {
        throw new Error('Contract not found');
      }

      // Verify user has permission
      if (
        role === 'student' &&
        (contract.studentId as any)._id.toString() !== userId
      ) {
        throw new Error('Only the student can sign as student');
      }
      if (role === 'tutor' && contract.tutorId.toString() !== userId) {
        throw new Error('Only the tutor can sign as tutor');
      }

      // Check contract status - Remove strict approval requirement
      if (contract.status === 'REJECTED') {
        throw new Error('Cannot sign rejected contracts');
      }
      // Allow signing for any non-rejected contract (PENDING_STUDENT_APPROVAL, APPROVED, etc.)

      if (contract.isLocked) {
        throw new Error('Contract is already locked after signing');
      }

      // Check if already signed by this role
      if (role === 'student' && contract.studentSignedAt) {
        throw new Error('Student has already signed this contract');
      }
      if (role === 'tutor' && contract.tutorSignedAt) {
        throw new Error('Tutor has already signed this contract');
      }

      // Calculate contract hash if not exists
      if (!contract.contractHash) {
        contract.contractHash = this.calculateContractHash(contract);
        contract.originalContent = JSON.stringify(contract.toObject());
        await contract.save();
      }

      return {
        contract,
        email:
          role === 'student'
            ? (contract.studentId as any).email
            : (contract.tutorId as any).email,
        recipientName:
          role === 'student'
            ? (contract.studentId as any).full_name
            : (contract.tutorId as any).full_name,
      };
    } catch (error: any) {
      logger.error('Error initiating contract signing:', error);
      throw error;
    }
  }

  /**
   * Verify and sign contract after OTP verification
   * - Records signature with timestamp
   * - Locks contract if both parties have signed
   * - Creates learning class when fully signed
   */
  async verifyAndSignContract(
    contractId: string,
    userId: string,
    role: 'student' | 'tutor',
    signatureData: {
      otpHash: string;
      email: string;
      ipAddress?: string;
      userAgent?: string;
      consentText: string;
    }
  ) {
    try {
      const contract = await Contract.findById(contractId);

      if (!contract) {
        throw new Error('Contract not found');
      }

      // Verify user permission
      if (role === 'student' && contract.studentId.toString() !== userId) {
        throw new Error('User mismatch');
      }
      if (role === 'tutor' && contract.tutorId.toString() !== userId) {
        throw new Error('User mismatch');
      }

      // Check if already signed
      if (role === 'student' && contract.studentSignedAt) {
        throw new Error('Already signed by student');
      }
      if (role === 'tutor' && contract.tutorSignedAt) {
        throw new Error('Already signed by tutor');
      }

      // Record signature timestamp
      const signedAt = new Date();
      if (role === 'student') {
        contract.studentSignedAt = signedAt;
      } else {
        contract.tutorSignedAt = signedAt;
      }

      // Check if both parties have now signed
      const fullySignedNow = contract.studentSignedAt && contract.tutorSignedAt;

      if (fullySignedNow) {
        contract.isSigned = true;
        contract.isLocked = true;
        contract.lockedAt = new Date();
      }

      await contract.save();

      logger.info(`Contract ${contractId} signed by ${role}: ${userId}`);

      // If fully signed, create learning class
      if (fullySignedNow) {
        await this.createLearningClassFromContract(contract);
        logger.info(
          `Contract ${contractId} fully signed and learning class created`
        );
      }

      return {
        success: true,
        contract,
        fullySignedNow,
      };
    } catch (error: any) {
      logger.error('Error verifying and signing contract:', error);
      throw error;
    }
  }

  /**
   * Validate contract integrity by comparing hash
   */
  async validateContractIntegrity(contractId: string): Promise<boolean> {
    try {
      const contract = await Contract.findById(contractId);

      if (!contract || !contract.contractHash || !contract.originalContent) {
        return false;
      }

      // Recalculate hash from original content
      const originalData = JSON.parse(contract.originalContent);
      const recalculatedHash = this.calculateContractHash(originalData);

      return recalculatedHash === contract.contractHash;
    } catch (error: any) {
      logger.error('Error validating contract integrity:', error);
      return false;
    }
  }

  /**
   * Get contract audit trail (signatures)
   */
  async getContractAuditTrail(contractId: string) {
    try {
      const ContractSignature =
        require('../../models/ContractSignature').ContractSignature;

      const signatures = await ContractSignature.find({
        contract_id: contractId,
      }).sort({ created_at: 1 });

      const contract = await Contract.findById(contractId);

      return {
        contract: {
          id: contract?._id,
          contractHash: contract?.contractHash,
          isSigned: contract?.isSigned,
          isLocked: contract?.isLocked,
          lockedAt: contract?.lockedAt,
          studentSignedAt: contract?.studentSignedAt,
          tutorSignedAt: contract?.tutorSignedAt,
        },
        signatures,
        integrityValid: await this.validateContractIntegrity(contractId),
      };
    } catch (error: any) {
      logger.error('Error getting contract audit trail:', error);
      throw error;
    }
  }
}
