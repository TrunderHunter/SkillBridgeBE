import { Contract, IContract } from '../../models/Contract';
import { PaymentSchedule } from '../../models/PaymentSchedule';
import { ContactRequest } from '../../models/ContactRequest';
import { TutorPost } from '../../models/TutorPost';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import {
  CreateContractInput,
  UpdateContractInput,
  SignContractInput,
  ContractFilters,
  CreatePaymentScheduleInput,
  UpdatePaymentInput,
  PaymentScheduleFilters,
} from '../../types/contract.types';

class ContractService {
  /**
   * Create new contract from accepted contact request
   */
  async createContract(tutorId: string, contractData: CreateContractInput) {
    try {
      // Validate contact request
      const contactRequest = await ContactRequest.findOne({
        _id: contractData.contactRequestId,
        tutorId,
        status: 'ACCEPTED',
      }).populate('tutorPostId');

      if (!contactRequest) {
        throw new Error('Không tìm thấy yêu cầu đã được chấp nhận');
      }

      // Check if contract already exists
      const existingContract = await Contract.findOne({
        contactRequestId: contractData.contactRequestId,
      });

      if (existingContract) {
        throw new Error('Hợp đồng đã được tạo cho yêu cầu này');
      }

      const tutorPost = contactRequest.tutorPostId as any;

      // Calculate total amount
      const totalAmount = contractData.pricePerSession * contractData.totalSessions;

      // Create contract
      const contract = new Contract({
        contactRequestId: contractData.contactRequestId,
        studentId: contactRequest.studentId,
        tutorId: contactRequest.tutorId,
        subject: contactRequest.subject,

        title: contractData.title,
        description: contractData.description,

        pricePerSession: contractData.pricePerSession,
        sessionDuration: contractData.sessionDuration,
        totalSessions: contractData.totalSessions,
        totalAmount,
        learningMode: contractData.learningMode,

        schedule: {
          ...contractData.schedule,
          timezone: contractData.schedule.timezone || 'Asia/Ho_Chi_Minh',
        },

        startDate: new Date(contractData.startDate),
        endDate: new Date(contractData.endDate),

        location: contractData.location,
        onlineInfo: contractData.onlineInfo,

        paymentTerms: {
          paymentMethod: contractData.paymentTerms.paymentMethod,
          installments: contractData.paymentTerms.installments,
          downPayment: contractData.paymentTerms.downPayment,
          paymentSchedule: [],
        },

        terms: contractData.terms || {},

        status: 'PENDING_STUDENT', // Student needs to review and sign first
        isFullySigned: false,
      });

      await contract.save();

      // Create payment schedules if installment payment
      if (contractData.paymentTerms.paymentMethod === 'INSTALLMENT' && contractData.paymentTerms.installments) {
        await this.createPaymentSchedules(contract._id, totalAmount, contractData.paymentTerms);
      }

      // Send notification to student
      try {
        const tutor = await User.findById(tutorId);
        const tutorName = tutor?.full_name || tutor?.email || 'Gia sư';
        const { notifyContractCreated } = await import('../notification/notification.helpers');
        await notifyContractCreated(
          contactRequest.studentId.toString(),
          tutorName,
          contract.title,
          contract._id.toString()
        );
      } catch (notifError) {
        logger.error('Failed to send contract notification:', notifError);
      }

      return {
        success: true,
        message: 'Tạo hợp đồng thành công',
        data: contract,
      };
    } catch (error: any) {
      logger.error('Create contract error:', error);
      throw new Error(error.message || 'Không thể tạo hợp đồng');
    }
  }

  /**
   * Create payment schedules for installment payment
   */
  private async createPaymentSchedules(
    contractId: string,
    totalAmount: number,
    paymentTerms: { installments?: number; downPayment?: number }
  ) {
    try {
      const contract = await Contract.findById(contractId);
      if (!contract) return;

      const installments = paymentTerms.installments || 1;
      const downPayment = paymentTerms.downPayment || 0;
      const remainingAmount = totalAmount - downPayment;
      const installmentAmount = Math.ceil(remainingAmount / installments);

      const schedules = [];
      const startDate = new Date(contract.startDate);

      // First payment (down payment if applicable)
      if (downPayment > 0) {
        const downPaymentSchedule = new PaymentSchedule({
          contractId,
          studentId: contract.studentId,
          tutorId: contract.tutorId,
          installmentNumber: 0,
          amount: downPayment,
          dueDate: startDate, // Due on start date
          status: 'PENDING',
        });
        await downPaymentSchedule.save();
        schedules.push(downPaymentSchedule._id);
      }

      // Subsequent installments
      for (let i = 1; i <= installments; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        const amount = i === installments 
          ? remainingAmount - (installmentAmount * (installments - 1)) // Last installment takes remainder
          : installmentAmount;

        const paymentSchedule = new PaymentSchedule({
          contractId,
          studentId: contract.studentId,
          tutorId: contract.tutorId,
          installmentNumber: i,
          amount,
          dueDate,
          status: 'PENDING',
        });
        await paymentSchedule.save();
        schedules.push(paymentSchedule._id);
      }

      // Update contract with payment schedule IDs
      contract.paymentTerms.paymentSchedule = schedules;
      await contract.save();
    } catch (error) {
      logger.error('Create payment schedules error:', error);
      throw error;
    }
  }

  /**
   * Get contract by ID
   */
  async getContractById(contractId: string, userId: string) {
    try {
      const contract = await Contract.findOne({
        _id: contractId,
        $or: [{ studentId: userId }, { tutorId: userId }],
      })
        .populate('studentId', 'full_name email phone_number avatar_url')
        .populate('tutorId', 'full_name email phone_number avatar_url')
        .populate('subject', 'name')
        .lean();

      if (!contract) {
        throw new Error('Không tìm thấy hợp đồng');
      }

      // Get payment schedules if any
      let paymentSchedules: any[] = [];
      if (contract.paymentTerms.paymentSchedule && contract.paymentTerms.paymentSchedule.length > 0) {
        paymentSchedules = await PaymentSchedule.find({
          contractId: contract._id,
        }).sort({ installmentNumber: 1 });
      }

      return {
        success: true,
        data: {
          ...contract,
          paymentSchedules,
        },
      };
    } catch (error: any) {
      logger.error('Get contract error:', error);
      throw new Error(error.message || 'Không thể lấy thông tin hợp đồng');
    }
  }

  /**
   * Get contracts for student
   */
  async getStudentContracts(studentId: string, filters?: ContractFilters) {
    try {
      const query: any = { studentId };

      if (filters?.status) {
        query.status = filters.status;
      }

      if (filters?.startDate) {
        query.startDate = { $gte: new Date(filters.startDate) };
      }

      if (filters?.endDate) {
        query.endDate = { $lte: new Date(filters.endDate) };
      }

      const contracts = await Contract.find(query)
        .populate('tutorId', 'full_name email avatar_url')
        .populate('subject', 'name')
        .sort({ createdAt: -1 })
        .lean();

      return {
        success: true,
        data: contracts,
        total: contracts.length,
      };
    } catch (error: any) {
      logger.error('Get student contracts error:', error);
      throw new Error(error.message || 'Không thể lấy danh sách hợp đồng');
    }
  }

  /**
   * Get contracts for tutor
   */
  async getTutorContracts(tutorId: string, filters?: ContractFilters) {
    try {
      const query: any = { tutorId };

      if (filters?.status) {
        query.status = filters.status;
      }

      if (filters?.startDate) {
        query.startDate = { $gte: new Date(filters.startDate) };
      }

      if (filters?.endDate) {
        query.endDate = { $lte: new Date(filters.endDate) };
      }

      const contracts = await Contract.find(query)
        .populate('studentId', 'full_name email avatar_url')
        .populate('subject', 'name')
        .sort({ createdAt: -1 })
        .lean();

      return {
        success: true,
        data: contracts,
        total: contracts.length,
      };
    } catch (error: any) {
      logger.error('Get tutor contracts error:', error);
      throw new Error(error.message || 'Không thể lấy danh sách hợp đồng');
    }
  }

  /**
   * Update contract (only for DRAFT status)
   */
  async updateContract(contractId: string, tutorId: string, updateData: UpdateContractInput) {
    try {
      const contract = await Contract.findOne({
        _id: contractId,
        tutorId,
        status: 'DRAFT',
      });

      if (!contract) {
        throw new Error('Không tìm thấy hợp đồng hoặc hợp đồng không thể chỉnh sửa');
      }

      // Update fields
      if (updateData.title) contract.title = updateData.title;
      if (updateData.description !== undefined) contract.description = updateData.description;
      if (updateData.schedule) {
        contract.schedule = { ...contract.schedule, ...updateData.schedule };
      }
      if (updateData.startDate) {
        contract.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate) {
        contract.endDate = new Date(updateData.endDate);
      }
      if (updateData.location) contract.location = updateData.location;
      if (updateData.onlineInfo) contract.onlineInfo = updateData.onlineInfo;
      if (updateData.paymentTerms) {
        contract.paymentTerms = { ...contract.paymentTerms, ...updateData.paymentTerms };
      }
      if (updateData.terms) {
        contract.terms = { ...contract.terms, ...updateData.terms };
      }

      await contract.save();

      return {
        success: true,
        message: 'Cập nhật hợp đồng thành công',
        data: contract,
      };
    } catch (error: any) {
      logger.error('Update contract error:', error);
      throw new Error(error.message || 'Không thể cập nhật hợp đồng');
    }
  }

  /**
   * Sign contract (tutor or student)
   */
  async signContract(userId: string, userRole: string, signData: SignContractInput) {
    try {
      const contract = await Contract.findOne({
        _id: signData.contractId,
        $or: [{ studentId: userId }, { tutorId: userId }],
      });

      if (!contract) {
        throw new Error('Không tìm thấy hợp đồng');
      }

      if (contract.status === 'ACTIVE' || contract.status === 'COMPLETED') {
        throw new Error('Hợp đồng đã được ký kết');
      }

      if (contract.status === 'CANCELLED' || contract.status === 'EXPIRED') {
        throw new Error('Hợp đồng không còn hiệu lực');
      }

      const signature = {
        signedAt: new Date(),
        ipAddress: signData.ipAddress,
        signatureData: signData.signatureData,
      };

      // Determine who is signing
      if (userRole === 'STUDENT' && contract.studentId.toString() === userId) {
        contract.studentSignature = signature;
        
        // If tutor hasn't signed yet, set status to PENDING_TUTOR
        if (!contract.tutorSignature) {
          contract.status = 'PENDING_TUTOR';
        }
      } else if (userRole === 'TUTOR' && contract.tutorId.toString() === userId) {
        contract.tutorSignature = signature;
        
        // If student hasn't signed yet, set status to PENDING_STUDENT
        if (!contract.studentSignature) {
          contract.status = 'PENDING_STUDENT';
        }
      } else {
        throw new Error('Người dùng không có quyền ký hợp đồng này');
      }

      // Check if both parties have signed
      if (contract.studentSignature && contract.tutorSignature) {
        contract.isFullySigned = true;
        contract.status = 'ACTIVE';
        contract.activatedAt = new Date();

        await contract.save();

        // Automatically create learning class from contract
        try {
          const { contactRequestService } = await import('../contactRequest/contactRequest.service');
          await contactRequestService.createLearningClassFromContract(contract._id);
        } catch (classError) {
          logger.error('Failed to create learning class from contract:', classError);
          // Don't throw error, just log it - contract is still valid
        }

        // Notify the other party
        try {
          const otherUserId = userRole === 'STUDENT' ? contract.tutorId.toString() : contract.studentId.toString();
          const { notifyContractFullySigned } = await import('../notification/notification.helpers');
          await notifyContractFullySigned(otherUserId, contract.title, contract._id.toString());
        } catch (notifError) {
          logger.error('Failed to send notification:', notifError);
        }
      } else {
        await contract.save();
        
        // Notify the other party to sign
        try {
          const otherUserId = userRole === 'STUDENT' ? contract.tutorId.toString() : contract.studentId.toString();
          const { notifyContractSignatureNeeded } = await import('../notification/notification.helpers');
          await notifyContractSignatureNeeded(otherUserId, contract.title, contract._id.toString());
        } catch (notifError) {
          logger.error('Failed to send notification:', notifError);
        }
      }

      return {
        success: true,
        message: contract.isFullySigned 
          ? 'Hợp đồng đã được ký kết hoàn tất và lớp học đã được tạo' 
          : 'Đã ký hợp đồng thành công, đang chờ bên kia ký',
        data: contract,
      };
    } catch (error: any) {
      logger.error('Sign contract error:', error);
      throw new Error(error.message || 'Không thể ký hợp đồng');
    }
  }

  /**
   * Cancel contract (before fully signed)
   */
  async cancelContract(contractId: string, userId: string, reason?: string) {
    try {
      const contract = await Contract.findOne({
        _id: contractId,
        $or: [{ studentId: userId }, { tutorId: userId }],
        status: { $in: ['DRAFT', 'PENDING_STUDENT', 'PENDING_TUTOR'] },
      });

      if (!contract) {
        throw new Error('Không tìm thấy hợp đồng hoặc hợp đồng không thể hủy');
      }

      contract.status = 'CANCELLED';
      await contract.save();

      // Cancel all pending payment schedules
      await PaymentSchedule.updateMany(
        { contractId, status: 'PENDING' },
        { status: 'CANCELLED' }
      );

      // Notify the other party
      try {
        const otherUserId = contract.studentId.toString() === userId 
          ? contract.tutorId.toString() 
          : contract.studentId.toString();
        const { notifyContractCancelled } = await import('../notification/notification.helpers');
        await notifyContractCancelled(otherUserId, contract.title, reason || 'Không có lý do');
      } catch (notifError) {
        logger.error('Failed to send notification:', notifError);
      }

      return {
        success: true,
        message: 'Đã hủy hợp đồng thành công',
        data: contract,
      };
    } catch (error: any) {
      logger.error('Cancel contract error:', error);
      throw new Error(error.message || 'Không thể hủy hợp đồng');
    }
  }

  /**
   * Get payment schedules for a contract
   */
  async getPaymentSchedules(contractId: string, userId: string, filters?: PaymentScheduleFilters) {
    try {
      // Verify user has access to this contract
      const contract = await Contract.findOne({
        _id: contractId,
        $or: [{ studentId: userId }, { tutorId: userId }],
      });

      if (!contract) {
        throw new Error('Không tìm thấy hợp đồng');
      }

      const query: any = { contractId };

      if (filters?.status) {
        query.status = filters.status;
      }

      if (filters?.fromDate) {
        query.dueDate = { $gte: new Date(filters.fromDate) };
      }

      if (filters?.toDate) {
        if (query.dueDate) {
          query.dueDate.$lte = new Date(filters.toDate);
        } else {
          query.dueDate = { $lte: new Date(filters.toDate) };
        }
      }

      const schedules = await PaymentSchedule.find(query)
        .sort({ installmentNumber: 1 })
        .lean();

      return {
        success: true,
        data: schedules,
        total: schedules.length,
      };
    } catch (error: any) {
      logger.error('Get payment schedules error:', error);
      throw new Error(error.message || 'Không thể lấy lịch thanh toán');
    }
  }

  /**
   * Mark payment as paid (student)
   */
  async markPaymentPaid(scheduleId: string, studentId: string, paymentData: UpdatePaymentInput) {
    try {
      const schedule = await PaymentSchedule.findOne({
        _id: scheduleId,
        studentId,
        status: 'PENDING',
      });

      if (!schedule) {
        throw new Error('Không tìm thấy lịch thanh toán hoặc đã được thanh toán');
      }

      schedule.status = 'PAID';
      schedule.paidAt = new Date();
      schedule.paidAmount = paymentData.paidAmount || schedule.amount;
      schedule.paymentMethod = paymentData.paymentMethod;
      schedule.transactionId = paymentData.transactionId;
      schedule.notes = paymentData.notes;

      await schedule.save();

      return {
        success: true,
        message: 'Đã ghi nhận thanh toán thành công',
        data: schedule,
      };
    } catch (error: any) {
      logger.error('Mark payment paid error:', error);
      throw new Error(error.message || 'Không thể cập nhật trạng thái thanh toán');
    }
  }
}

export const contractService = new ContractService();
