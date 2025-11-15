import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { ContractService } from '../../services/contract/contract.service';
import { PaymentService } from '../../services/contract/payment.service';
import type {
  CreateContractInput,
  StudentContractResponse,
  ContractFilters,
} from '../../types/contract.types';
import { successResponse, errorResponse } from '../../utils/response';
import { logger } from '../../utils/logger';

export class ContractController {
  private contractService: ContractService;
  private paymentService: PaymentService;

  constructor() {
    this.contractService = new ContractService();
    this.paymentService = new PaymentService();
  }

  // Create contract from contact request
  createContract = async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, errors.array());
      }

      const tutorId = req.user!.id;
      const contractData: CreateContractInput = req.body;

      // Create contract
      const contract = await this.contractService.createContract(
        tutorId,
        contractData
      );

      logger.info(`Contract created: ${contract.id} by tutor: ${tutorId}`);

      return successResponse(
        res,
        'Contract created successfully',
        contract,
        201
      );
    } catch (error: any) {
      logger.error('Error creating contract:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // Get contracts for tutor
  getTutorContracts = async (req: Request, res: Response) => {
    try {
      const tutorId = req.user!.id;
      const filters: ContractFilters = req.query;

      const result = await this.contractService.getContractsByTutor(
        tutorId,
        filters
      );

      return successResponse(res, 'Contracts retrieved successfully', result);
    } catch (error: any) {
      logger.error('Error getting tutor contracts:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // Get contracts for student
  getStudentContracts = async (req: Request, res: Response) => {
    try {
      const studentId = req.user!.id;
      const filters: ContractFilters = req.query;

      const result = await this.contractService.getContractsByStudent(
        studentId,
        filters
      );

      return successResponse(res, 'Contracts retrieved successfully', result);
    } catch (error: any) {
      logger.error('Error getting student contracts:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // Get pending contracts for student (need approval)
  getPendingContracts = async (req: Request, res: Response) => {
    try {
      const studentId = req.user!.id;

      const contracts =
        await this.contractService.getPendingContractsForStudent(studentId);

      return successResponse(
        res,
        'Pending contracts retrieved successfully',
        contracts
      );
    } catch (error: any) {
      logger.error('Error getting pending contracts:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // Get contract by ID
  getContractById = async (req: Request, res: Response) => {
    try {
      const { contractId } = req.params;
      const userId = req.user!.id;

      const contract = await this.contractService.getContractById(
        contractId,
        userId
      );

      return successResponse(res, 'Contract retrieved successfully', contract);
    } catch (error: any) {
      logger.error('Error getting contract:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // Student respond to contract (approve/reject)
  respondToContract = async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, errors.array());
      }

      const { contractId } = req.params;
      const studentId = req.user!.id;
      const response: StudentContractResponse = req.body;

      const result = await this.contractService.respondToContract(
        contractId,
        studentId,
        response
      );

      const action =
        response.action === 'APPROVE'
          ? 'approved'
          : response.action === 'REJECT'
            ? 'rejected'
            : 'requested changes for';

      logger.info(`Contract ${contractId} ${action} by student: ${studentId}`);

      return successResponse(res, `Contract ${action} successfully`, result);
    } catch (error: any) {
      logger.error('Error responding to contract:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // NEW: Student approve and sign contract in one action
  approveAndSignContract = async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, errors.array());
      }

      const { contractId } = req.params;
      const { otpCode, consentText, message } = req.body;
      const studentId = req.user!.id;

      // Check current contract status first
      const { Contract } = require('../../models');
      const existingContract = await Contract.findById(contractId);
      if (!existingContract) {
        return errorResponse(res, 'Contract not found', 404);
      }

      // Step 1: Approve contract (only if not already approved)
      let approveResult = existingContract;
      if (existingContract.status === 'PENDING_STUDENT_APPROVAL') {
        approveResult = await this.contractService.respondToContract(
          contractId,
          studentId,
          { action: 'APPROVE', message }
        );
      } else if (existingContract.status !== 'APPROVED') {
        return errorResponse(
          res,
          `Cannot sign contract with status: ${existingContract.status}`,
          400
        );
      }
      // If already approved, skip approval step

      // Step 2: Verify OTP and sign contract
      // Import services
      const {
        contractOTPService,
      } = require('../../services/otp/contractOTP.service');
      const { ContractSignature } = require('../../models/ContractSignature');

      // Get user email
      const { User } = require('../../models');
      const user = await User.findById(studentId).select('email');
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Verify OTP
      const { otpHash } = await contractOTPService.verifyContractOTP({
        contractId,
        email: user.email,
        otpCode,
        role: 'student',
      });

      // Get client info for audit
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');

      // Save signature record
      await ContractSignature.create({
        contract_id: contractId,
        signer_id: studentId,
        signer_role: 'student',
        email: user.email,
        otp_hash: otpHash,
        ip_address: ipAddress,
        user_agent: userAgent,
        signed_at: new Date(),
        consent_text: consentText,
        verification_attempts: 1,
        status: 'verified', // Use lowercase as per enum definition
      });

      // Step 3: Sign contract (this will create learning class if both signed)
      const signResult = await this.contractService.verifyAndSignContract(
        contractId,
        studentId,
        'student',
        {
          otpHash,
          email: user.email,
          ipAddress,
          userAgent,
          consentText,
        }
      );

      logger.info(
        `Contract ${contractId} approved and signed by student: ${studentId}`
      );

      return successResponse(
        res,
        'Hợp đồng đã được phê duyệt và ký thành công',
        {
          contractId,
          approvedAt: approveResult.approvedAt,
          signedAt: new Date(),
          fullySignedNow: signResult.fullySignedNow,
          message: signResult.fullySignedNow
            ? 'Hợp đồng đã được cả hai bên ký kết. Lớp học đã được tạo.'
            : 'Hợp đồng đã được phê duyệt và ký. Chờ gia sư ký hợp đồng để tạo lớp học.',
        }
      );
    } catch (error: any) {
      logger.error('Error approving and signing contract:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // AUTO SIGN: Tutor automatically signs contract when creating it
  autoSignForTutor = async (req: Request, res: Response) => {
    try {
      const { contractId } = req.params;
      const tutorId = req.user!.id;

      // Get user info
      const { User } = require('../../models');
      const user = await User.findById(tutorId).select('email full_name');
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Auto-generate consent text for tutor
      const consentText = `Tôi, với tư cách là gia sư, đã tạo và đồng ý với tất cả các điều khoản trong hợp đồng này. Việc ký kết được thực hiện tự động khi tạo hợp đồng. Ngày ký: ${new Date().toLocaleDateString('vi-VN')}`;

      // Get client info for audit
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');

      // Create a mock OTP hash for auto-signing (for audit purposes)
      const crypto = require('crypto');
      const autoOtpHash = crypto
        .createHash('sha256')
        .update(`AUTO_SIGN_${tutorId}_${contractId}_${Date.now()}`)
        .digest('hex');

      // Import services
      const { ContractSignature } = require('../../models/ContractSignature');

      // Save signature record for audit trail
      await ContractSignature.create({
        contract_id: contractId,
        signer_id: tutorId,
        signer_role: 'tutor',
        email: user.email,
        otp_hash: autoOtpHash,
        ip_address: ipAddress,
        user_agent: userAgent,
        signed_at: new Date(),
        consent_text: consentText,
        verification_attempts: 0, // Auto-signing doesn't require OTP attempts
        status: 'verified',
      });

      // Sign the contract
      const signResult = await this.contractService.verifyAndSignContract(
        contractId,
        tutorId,
        'tutor',
        {
          otpHash: autoOtpHash,
          email: user.email,
          ipAddress,
          userAgent,
          consentText,
        }
      );

      logger.info(`Contract ${contractId} auto-signed by tutor: ${tutorId}`);

      return successResponse(res, 'Hợp đồng đã được ký tự động bởi gia sư', {
        contractId,
        signedAt: new Date(),
        autoSigned: true,
        tutorSigned: true,
        awaitingStudentApproval: true,
      });
    } catch (error: any) {
      logger.error('Error auto-signing contract for tutor:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // Cancel contract (by tutor or student)
  cancelContract = async (req: Request, res: Response) => {
    try {
      const { contractId } = req.params;
      const userId = req.user!.id;
      const { reason } = req.body;

      const contract = await this.contractService.cancelContract(
        contractId,
        userId,
        reason
      );

      logger.info(`Contract ${contractId} cancelled by user: ${userId}`);

      return successResponse(res, 'Contract cancelled successfully', contract);
    } catch (error: any) {
      logger.error('Error cancelling contract:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // Get payment schedule for contract
  getPaymentSchedule = async (req: Request, res: Response) => {
    try {
      const { contractId } = req.params;
      const userId = req.user!.id;

      const paymentSchedule =
        await this.paymentService.getPaymentScheduleByContract(
          contractId,
          userId
        );

      return successResponse(
        res,
        'Payment schedule retrieved successfully',
        paymentSchedule
      );
    } catch (error: any) {
      logger.error('Error getting payment schedule:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // Process payment for installment
  processPayment = async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, errors.array());
      }

      const { paymentScheduleId } = req.params;
      const userId = req.user!.id;
      const paymentData = req.body;

      const result = await this.paymentService.processPayment(
        paymentScheduleId,
        userId,
        paymentData
      );

      logger.info(
        `Payment processed for schedule: ${paymentScheduleId} by user: ${userId}`
      );

      return successResponse(res, 'Payment processed successfully', result);
    } catch (error: any) {
      logger.error('Error processing payment:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // Get student payment schedules
  getStudentPaymentSchedules = async (req: Request, res: Response) => {
    try {
      const studentId = req.user!.id;
      const filters = req.query;

      const schedules = await this.paymentService.getPaymentSchedulesByStudent(
        studentId,
        filters
      );

      return successResponse(
        res,
        'Payment schedules retrieved successfully',
        schedules
      );
    } catch (error: any) {
      logger.error('Error getting student payment schedules:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // Get tutor payment schedules
  getTutorPaymentSchedules = async (req: Request, res: Response) => {
    try {
      const tutorId = req.user!.id;
      const filters = req.query;

      const schedules = await this.paymentService.getPaymentSchedulesByTutor(
        tutorId,
        filters
      );

      return successResponse(
        res,
        'Payment schedules retrieved successfully',
        schedules
      );
    } catch (error: any) {
      logger.error('Error getting tutor payment schedules:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // Admin endpoints for contract management
  getAllContracts = async (req: Request, res: Response) => {
    try {
      const filters: ContractFilters = req.query;

      const result = await this.contractService.getAllContracts(filters);

      return successResponse(
        res,
        'All contracts retrieved successfully',
        result
      );
    } catch (error: any) {
      logger.error('Error getting all contracts:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // Get contract statistics
  getContractStats = async (req: Request, res: Response) => {
    try {
      const stats = await this.contractService.getContractStatistics();

      return successResponse(
        res,
        'Contract statistics retrieved successfully',
        stats
      );
    } catch (error: any) {
      logger.error('Error getting contract stats:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  // ============================================
  // CONTRACT SIGNING ENDPOINTS (OTP-based e-signature)
  // ============================================

  /**
   * POST /contracts/:id/initiate-signing
   * Initiate contract signing process - sends OTP via email
   */
  initiateContractSigning = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, errors.array());
      }

      const { id: contractId } = req.params;
      const { role } = req.body; // 'student' or 'tutor'
      const userId = req.user!.id;

      // Import OTP service
      const {
        contractOTPService,
      } = require('../../services/otp/contractOTP.service');

      // Initiate signing (validates permissions, generates hash)
      const { contract, email, recipientName } =
        await this.contractService.initiateContractSigning(
          contractId,
          userId,
          role
        );

      // Generate contract code for display (you may want to get this from contract model)
      const contractCode = `HĐ-${contract._id.substring(0, 8).toUpperCase()}`;

      // Generate and send OTP
      const otpResult = await contractOTPService.generateContractOTP({
        contractId,
        email,
        recipientName,
        contractCode,
        role,
      });

      logger.info(`Contract signing initiated for ${role}: ${contractId}`);

      return successResponse(res, 'OTP đã được gửi tới email của bạn', {
        contractId,
        email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email for security
        expiresAt: otpResult.expiresAt,
        role,
      });
    } catch (error: any) {
      logger.error('Error initiating contract signing:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  /**
   * POST /contracts/:id/verify-signature
   * Verify OTP and sign contract
   */
  verifyContractSignature = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, errors.array());
      }

      const { id: contractId } = req.params;
      const { otpCode, role, consentText } = req.body;
      const userId = req.user!.id;

      // Import services
      const {
        contractOTPService,
      } = require('../../services/otp/contractOTP.service');
      const { ContractSignature } = require('../../models/ContractSignature');

      // Get user email
      const { User } = require('../../models');
      const user = await User.findById(userId).select('email');
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Verify OTP
      const { otpHash } = await contractOTPService.verifyContractOTP({
        contractId,
        email: user.email,
        otpCode,
        role,
      });

      // Get client info for audit
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');

      // Save signature record
      await ContractSignature.create({
        contract_id: contractId,
        signer_id: userId,
        signer_role: role,
        email: user.email,
        otp_hash: otpHash,
        ip_address: ipAddress,
        user_agent: userAgent,
        signed_at: new Date(),
        consent_text: consentText,
        verification_attempts: 1,
        status: 'VERIFIED',
      });

      // Sign contract
      const result = await this.contractService.verifyAndSignContract(
        contractId,
        userId,
        role,
        {
          otpHash,
          email: user.email,
          ipAddress,
          userAgent,
          consentText,
        }
      );

      logger.info(`Contract signed successfully by ${role}: ${contractId}`);

      return successResponse(res, 'Hợp đồng đã được ký thành công', {
        contractId,
        signedAt: new Date(),
        role,
        fullySignedNow: result.fullySignedNow,
        message: result.fullySignedNow
          ? 'Hợp đồng đã được cả hai bên ký kết. Lớp học đã được tạo.'
          : 'Chờ bên còn lại ký hợp đồng.',
      });
    } catch (error: any) {
      logger.error('Error verifying contract signature:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  /**
   * POST /contracts/:id/resend-otp
   * Resend OTP for contract signing
   */
  resendContractOTP = async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, errors.array());
      }

      const { id: contractId } = req.params;
      const { role } = req.body;
      const userId = req.user!.id;

      const {
        contractOTPService,
      } = require('../../services/otp/contractOTP.service');

      // Initiate signing again (validates permissions)
      const { contract, email, recipientName } =
        await this.contractService.initiateContractSigning(
          contractId,
          userId,
          role
        );

      const contractCode = `HĐ-${contract._id.substring(0, 8).toUpperCase()}`;

      // Resend OTP
      const otpResult = await contractOTPService.resendContractOTP({
        contractId,
        email,
        recipientName,
        contractCode,
        role,
      });

      logger.info(`Contract OTP resent for ${role}: ${contractId}`);

      return successResponse(res, 'OTP mới đã được gửi tới email của bạn', {
        contractId,
        email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
        expiresAt: otpResult.expiresAt,
      });
    } catch (error: any) {
      logger.error('Error resending contract OTP:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };

  /**
   * GET /contracts/:id/audit-trail
   * Get contract signing audit trail
   */
  getContractAuditTrail = async (req: Request, res: Response) => {
    try {
      const { id: contractId } = req.params;
      const userId = req.user!.id;

      // Check user has permission to view audit trail
      const contract = await this.contractService.getContractById(
        contractId,
        userId
      );
      if (!contract) {
        return errorResponse(res, 'Contract not found or no permission', 404);
      }

      const auditTrail =
        await this.contractService.getContractAuditTrail(contractId);

      return successResponse(
        res,
        'Contract audit trail retrieved successfully',
        auditTrail
      );
    } catch (error: any) {
      logger.error('Error getting contract audit trail:', error);
      return errorResponse(res, error.message, error.statusCode || 500);
    }
  };
}
