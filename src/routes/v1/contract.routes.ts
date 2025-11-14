import { Router } from 'express';
import { ContractController } from '../../controllers/contract/contract.controller';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { validateContract } from '../../validators/contract.validator';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/v1/contracts
 * @desc    Create new contract from accepted contact request (tutor only)
 * @access  Private (Tutor)
 */
router.post(
  '/',
  validateContract.createContract,
  ContractController.createContract
);

/**
 * @route   GET /api/v1/contracts/student
 * @desc    Get student's contracts
 * @access  Private (Student)
 */
router.get('/student', ContractController.getStudentContracts);

/**
 * @route   GET /api/v1/contracts/tutor
 * @desc    Get tutor's contracts
 * @access  Private (Tutor)
 */
router.get('/tutor', ContractController.getTutorContracts);

/**
 * @route   GET /api/v1/contracts/:contractId
 * @desc    Get contract by ID
 * @access  Private
 */
router.get('/:contractId', ContractController.getContractById);

/**
 * @route   PUT /api/v1/contracts/:contractId
 * @desc    Update contract (tutor only, DRAFT status only)
 * @access  Private (Tutor)
 */
router.put(
  '/:contractId',
  validateContract.updateContract,
  ContractController.updateContract
);

/**
 * @route   POST /api/v1/contracts/:contractId/sign
 * @desc    Sign contract (both tutor and student)
 * @access  Private
 */
router.post(
  '/:contractId/sign',
  validateContract.signContract,
  ContractController.signContract
);

/**
 * @route   POST /api/v1/contracts/:contractId/cancel
 * @desc    Cancel contract
 * @access  Private
 */
router.post('/:contractId/cancel', ContractController.cancelContract);

/**
 * @route   GET /api/v1/contracts/:contractId/payment-schedules
 * @desc    Get payment schedules for a contract
 * @access  Private
 */
router.get('/:contractId/payment-schedules', ContractController.getPaymentSchedules);

/**
 * @route   POST /api/v1/contracts/payment-schedules/:scheduleId/pay
 * @desc    Mark payment as paid (student only)
 * @access  Private (Student)
 */
router.post(
  '/payment-schedules/:scheduleId/pay',
  validateContract.markPaymentPaid,
  ContractController.markPaymentPaid
);

export default router;
