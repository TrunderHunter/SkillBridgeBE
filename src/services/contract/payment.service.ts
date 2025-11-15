import { PaymentSchedule, Contract } from '../../models';
import {
  CreatePaymentScheduleInput,
  ProcessPaymentInput,
} from '../../types/contract.types';
import { logger } from '../../utils/logger';

export class PaymentService {
  async createPaymentSchedule(input: CreatePaymentScheduleInput) {
    try {
      // Get contract details
      const contract = await Contract.findById(input.contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Calculate payment schedule
      const installments = this.calculateInstallments(
        contract.totalAmount,
        input.paymentMethod,
        input.installmentPlan
      );

      // Create payment schedule
      const paymentSchedule = new PaymentSchedule({
        contractId: input.contractId,
        studentId: contract.studentId,
        tutorId: contract.tutorId,
        totalAmount: contract.totalAmount,
        paidAmount: 0,
        remainingAmount: contract.totalAmount, // Explicitly set remaining amount
        paymentMethod: input.paymentMethod,
        installments: installments,
        firstPaymentDueDate: installments[0].dueDate,
        lastPaymentDueDate: installments[installments.length - 1].dueDate,
        paymentTerms: {
          lateFeePercentage: input.paymentTerms?.lateFeePercentage || 5,
          gracePeriodDays: input.paymentTerms?.gracePeriodDays || 3,
          cancellationPolicy: input.paymentTerms?.cancellationPolicy || {
            refundPercentage: 80,
            minimumNoticeDays: 7,
          },
        },
        status: 'PENDING',
      });

      await paymentSchedule.save();

      logger.info(`Payment schedule created for contract: ${input.contractId}`);

      return paymentSchedule;
    } catch (error: any) {
      logger.error('Error creating payment schedule:', error);
      throw new Error(error.message || 'Failed to create payment schedule');
    }
  }

  async activatePaymentSchedule(contractId: string) {
    try {
      const paymentSchedule = await PaymentSchedule.findOne({ contractId });
      if (!paymentSchedule) {
        throw new Error('Payment schedule not found');
      }

      paymentSchedule.status = 'ACTIVE';
      await paymentSchedule.save();

      logger.info(`Payment schedule activated for contract: ${contractId}`);

      return paymentSchedule;
    } catch (error: any) {
      logger.error('Error activating payment schedule:', error);
      throw error;
    }
  }

  async cancelPaymentSchedule(contractId: string) {
    try {
      const paymentSchedule = await PaymentSchedule.findOne({ contractId });
      if (!paymentSchedule) {
        return; // No payment schedule to cancel
      }

      paymentSchedule.status = 'CANCELLED';
      paymentSchedule.cancelledAt = new Date();

      // Mark all pending installments as cancelled
      paymentSchedule.installments.forEach((installment) => {
        if (
          installment.status === 'PENDING' ||
          installment.status === 'OVERDUE'
        ) {
          installment.status = 'CANCELLED';
        }
      });

      await paymentSchedule.save();

      logger.info(`Payment schedule cancelled for contract: ${contractId}`);

      return paymentSchedule;
    } catch (error: any) {
      logger.error('Error cancelling payment schedule:', error);
      throw error;
    }
  }

  async processPayment(
    paymentScheduleId: string,
    userId: string,
    paymentData: ProcessPaymentInput
  ) {
    try {
      const paymentSchedule = await PaymentSchedule.findOne({
        _id: paymentScheduleId,
        studentId: userId,
        status: { $in: ['ACTIVE', 'OVERDUE'] },
      });

      if (!paymentSchedule) {
        throw new Error('Payment schedule not found or access denied');
      }

      // Find the installment
      const installment = paymentSchedule.installments.find(
        (i) =>
          i.installmentNumber === paymentData.installmentNumber &&
          i.status === 'PENDING'
      );

      if (!installment) {
        throw new Error('Installment not found or already paid');
      }

      // Verify payment amount
      if (paymentData.amount !== installment.amount) {
        throw new Error('Payment amount does not match installment amount');
      }

      // Update installment
      installment.status = 'PAID';
      installment.paidAt = new Date();
      installment.paymentMethod = paymentData.paymentMethod;
      installment.transactionId = paymentData.transactionId;
      installment.notes = paymentData.notes;

      // Update payment schedule totals
      paymentSchedule.paidAmount += paymentData.amount;

      // Check if all payments are completed
      const allPaid = paymentSchedule.installments.every(
        (i) => i.status === 'PAID' || i.status === 'CANCELLED'
      );

      if (allPaid) {
        paymentSchedule.status = 'COMPLETED';
        paymentSchedule.completedAt = new Date();
      }

      await paymentSchedule.save();

      logger.info(
        `Payment processed for schedule: ${paymentScheduleId}, installment: ${paymentData.installmentNumber}`
      );

      return paymentSchedule;
    } catch (error: any) {
      logger.error('Error processing payment:', error);
      throw new Error(error.message || 'Failed to process payment');
    }
  }

  async getPaymentScheduleByContract(contractId: string, userId: string) {
    try {
      const paymentSchedule = await PaymentSchedule.findOne({
        contractId,
        $or: [{ studentId: userId }, { tutorId: userId }],
      }).populate([
        { path: 'studentId', select: 'full_name email' },
        { path: 'tutorId', select: 'full_name email' },
      ]);

      if (!paymentSchedule) {
        throw new Error('Payment schedule not found or access denied');
      }

      // Check for overdue payments
      paymentSchedule.checkOverduePayments();
      await paymentSchedule.save();

      return paymentSchedule;
    } catch (error: any) {
      logger.error('Error getting payment schedule:', error);
      throw new Error(error.message || 'Failed to get payment schedule');
    }
  }

  async getPaymentSchedulesByStudent(studentId: string, filters: any = {}) {
    try {
      const { status, page = 1, limit = 10 } = filters;
      const skip = (page - 1) * limit;

      const query: any = { studentId };
      if (status) query.status = status;

      const schedules = await PaymentSchedule.find(query)
        .populate([
          { path: 'tutorId', select: 'full_name email' },
          { path: 'contractId', select: 'title' },
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await PaymentSchedule.countDocuments(query);

      // Check for overdue payments
      for (const schedule of schedules) {
        schedule.checkOverduePayments();
        await schedule.save();
      }

      return {
        schedules,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error('Error getting student payment schedules:', error);
      throw new Error(error.message || 'Failed to get payment schedules');
    }
  }

  async getPaymentSchedulesByTutor(tutorId: string, filters: any = {}) {
    try {
      const { status, page = 1, limit = 10 } = filters;
      const skip = (page - 1) * limit;

      const query: any = { tutorId };
      if (status) query.status = status;

      const schedules = await PaymentSchedule.find(query)
        .populate([
          { path: 'studentId', select: 'full_name email' },
          { path: 'contractId', select: 'title' },
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await PaymentSchedule.countDocuments(query);

      return {
        schedules,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error('Error getting tutor payment schedules:', error);
      throw new Error(error.message || 'Failed to get payment schedules');
    }
  }

  async updatePaymentScheduleWithClass(
    contractId: string,
    learningClassId: string
  ) {
    try {
      const paymentSchedule = await PaymentSchedule.findOne({ contractId });
      if (paymentSchedule) {
        paymentSchedule.learningClassId = learningClassId;
        await paymentSchedule.save();
      }
    } catch (error: any) {
      logger.error('Error updating payment schedule with class:', error);
      // Don't throw - this is not critical
    }
  }

  private calculateInstallments(
    totalAmount: number,
    paymentMethod: string,
    installmentPlan?: any
  ) {
    const installments = [];
    const now = new Date();

    if (paymentMethod === 'FULL_PAYMENT') {
      // Single payment due in 3 days
      installments.push({
        installmentNumber: 1,
        amount: totalAmount,
        dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        status: 'PENDING' as const,
      });
    } else {
      // Multiple installments
      const numberOfInstallments = installmentPlan?.numberOfInstallments || 2;
      const firstPaymentPercentage =
        installmentPlan?.firstPaymentPercentage || 50;

      const firstPaymentAmount = Math.round(
        (totalAmount * firstPaymentPercentage) / 100
      );
      const remainingAmount = totalAmount - firstPaymentAmount;
      const subsequentPaymentAmount = Math.round(
        remainingAmount / (numberOfInstallments - 1)
      );

      // First payment - due in 3 days
      installments.push({
        installmentNumber: 1,
        amount: firstPaymentAmount,
        dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        status: 'PENDING' as const,
      });

      // Subsequent payments - monthly
      for (let i = 2; i <= numberOfInstallments; i++) {
        const dueDate = new Date(now.getTime() + i * 30 * 24 * 60 * 60 * 1000);
        const amount =
          i === numberOfInstallments
            ? remainingAmount -
              subsequentPaymentAmount * (numberOfInstallments - 2)
            : subsequentPaymentAmount;

        installments.push({
          installmentNumber: i,
          amount: amount,
          dueDate: dueDate,
          status: 'PENDING' as const,
        });
      }
    }

    return installments;
  }
}
