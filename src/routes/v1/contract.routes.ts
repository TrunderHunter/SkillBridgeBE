import express from 'express';
import { ContractController } from '../../controllers/contract/contract.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tutorMiddleware } from '../../middlewares/tutor.middleware';
import { studentMiddleware } from '../../middlewares/student.middleware';
import { validateContract } from '../../validators/contract.validator';
import { validationMiddleware } from '../../middlewares/validation.middleware';

const router = express.Router();
const contractController = new ContractController();

// All contract routes require authentication
router.use(authMiddleware);

// ==================== CONTRACT MANAGEMENT ====================

// Create contract (Tutor only)
router.post(
  '/',
  tutorMiddleware,
  ...validateContract.createContract,
  validationMiddleware,
  contractController.createContract
);

// Get tutor's contracts
router.get(
  '/tutor/my-contracts',
  tutorMiddleware,
  contractController.getTutorContracts
);

// Get student's contracts
router.get(
  '/student/my-contracts',
  studentMiddleware,
  contractController.getStudentContracts
);

// Get pending contracts for student approval
router.get(
  '/student/pending',
  studentMiddleware,
  contractController.getPendingContracts
);

// Get contract by ID (both tutor and student can access)
router.get('/:contractId', contractController.getContractById);

// Student respond to contract (approve/reject/request changes)
router.put(
  '/:contractId/respond',
  studentMiddleware,
  ...validateContract.respondToContract,
  validationMiddleware,
  contractController.respondToContract
);

// NEW: Student approve and sign contract in one action
router.put(
  '/:contractId/approve-and-sign',
  studentMiddleware,
  ...validateContract.approveAndSignContract,
  validationMiddleware,
  contractController.approveAndSignContract
);

// NEW: Auto-sign contract for tutor (when creating contract)
router.put(
  '/:contractId/auto-sign-tutor',
  tutorMiddleware,
  contractController.autoSignForTutor
);

// Cancel contract (both tutor and student can cancel)
router.put(
  '/:contractId/cancel',
  ...validateContract.cancelContract,
  validationMiddleware,
  contractController.cancelContract
);

// ==================== PAYMENT MANAGEMENT ====================

// Get payment schedule for contract
router.get(
  '/:contractId/payment-schedule',
  contractController.getPaymentSchedule
);

// Get student's payment schedules
router.get(
  '/student/payment-schedules',
  studentMiddleware,
  contractController.getStudentPaymentSchedules
);

// Get tutor's payment schedules
router.get(
  '/tutor/payment-schedules',
  tutorMiddleware,
  contractController.getTutorPaymentSchedules
);

// Process payment for installment (Student only)
router.post(
  '/payment-schedules/:paymentScheduleId/pay',
  studentMiddleware,
  ...validateContract.processPayment,
  validationMiddleware,
  contractController.processPayment
);

// ==================== CONTRACT SIGNING (OTP-based E-signature) ====================

// Initiate contract signing - sends OTP to email
router.post(
  '/:id/initiate-signing',
  ...validateContract.initiateContractSigning,
  validationMiddleware,
  contractController.initiateContractSigning
);

// Verify OTP and sign contract
router.post(
  '/:id/verify-signature',
  ...validateContract.verifyContractSignature,
  validationMiddleware,
  contractController.verifyContractSignature
);

// Resend OTP for contract signing
router.post(
  '/:id/resend-otp',
  ...validateContract.resendContractOTP,
  validationMiddleware,
  contractController.resendContractOTP
);

// Get contract audit trail (signature records)
router.get('/:id/audit-trail', contractController.getContractAuditTrail);

// ==================== ADMIN ROUTES ====================

// Get all contracts (Admin only)
router.get(
  '/admin/all',
  // Add admin middleware here when available
  contractController.getAllContracts
);

// Get contract statistics (Admin only)
router.get(
  '/admin/stats',
  // Add admin middleware here when available
  contractController.getContractStats
);

export { router as contractRoutes };
