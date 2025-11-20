/**
 * Migration Script: Update Payment Methods to VNPay Only
 *
 * Purpose:
 * - Remove all payment methods except VNPAY
 * - Update existing payments to use VNPAY
 * - Update PaymentSchedule installments
 *
 * Run: npx ts-node src/scripts/migrations/update-payment-method-vnpay.ts
 */

import mongoose from 'mongoose';
import { Payment } from '../../models/Payment';
import { PaymentSchedule } from '../../models/PaymentSchedule';
import { logger } from '../../utils/logger';

const VNPAY_METHOD = 'VNPAY';

async function updatePaymentMethodsToVNPay() {
  try {
    logger.info('🚀 Starting migration: Update payment methods to VNPAY only');

    // Connect to database
    const MONGODB_URI =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/skillbridge';
    await mongoose.connect(MONGODB_URI);
    logger.info('✅ Connected to database');

    // Statistics
    let stats = {
      paymentsUpdated: 0,
      paymentSchedulesUpdated: 0,
      installmentsUpdated: 0,
      errors: 0,
    };

    // 1. Update Payment model records
    logger.info('📝 Step 1: Updating Payment records...');
    const payments = await Payment.find({
      paymentMethod: { $ne: VNPAY_METHOD },
    });

    for (const payment of payments) {
      try {
        const oldMethod = payment.paymentMethod;
        payment.paymentMethod = VNPAY_METHOD;
        await payment.save();
        stats.paymentsUpdated++;
        logger.info(
          `  ✓ Updated Payment ${payment.orderId}: ${oldMethod} → ${VNPAY_METHOD}`
        );
      } catch (error) {
        stats.errors++;
        logger.error(`  ✗ Failed to update Payment ${payment.orderId}:`, error);
      }
    }

    // 2. Update PaymentSchedule installments
    logger.info('📝 Step 2: Updating PaymentSchedule installments...');
    const paymentSchedules = await PaymentSchedule.find({
      'installments.paymentMethod': { $exists: true, $ne: VNPAY_METHOD },
    });

    for (const schedule of paymentSchedules) {
      try {
        let installmentsChanged = 0;

        schedule.installments.forEach((installment) => {
          if (
            installment.paymentMethod &&
            installment.paymentMethod !== VNPAY_METHOD
          ) {
            const oldMethod = installment.paymentMethod;
            installment.paymentMethod = VNPAY_METHOD;
            installmentsChanged++;
            logger.info(
              `  ✓ Updated Installment #${installment.installmentNumber} (Session ${installment.sessionNumber}): ${oldMethod} → ${VNPAY_METHOD}`
            );
          }
        });

        if (installmentsChanged > 0) {
          await schedule.save();
          stats.paymentSchedulesUpdated++;
          stats.installmentsUpdated += installmentsChanged;
          logger.info(
            `  ✓ Updated PaymentSchedule ${schedule._id}: ${installmentsChanged} installments changed`
          );
        }
      } catch (error) {
        stats.errors++;
        logger.error(
          `  ✗ Failed to update PaymentSchedule ${schedule._id}:`,
          error
        );
      }
    }

    // 3. Summary
    logger.info('\n📊 Migration Summary:');
    logger.info(`  ✅ Payments updated: ${stats.paymentsUpdated}`);
    logger.info(
      `  ✅ PaymentSchedules updated: ${stats.paymentSchedulesUpdated}`
    );
    logger.info(`  ✅ Installments updated: ${stats.installmentsUpdated}`);
    logger.info(`  ❌ Errors: ${stats.errors}`);

    // 4. Verification
    logger.info('\n🔍 Verification:');
    const remainingNonVNPay = await Payment.countDocuments({
      paymentMethod: { $ne: VNPAY_METHOD },
    });
    const remainingInstallments = await PaymentSchedule.countDocuments({
      'installments.paymentMethod': { $exists: true, $ne: VNPAY_METHOD },
    });

    logger.info(`  Remaining non-VNPAY Payments: ${remainingNonVNPay}`);
    logger.info(`  Remaining non-VNPAY Installments: ${remainingInstallments}`);

    if (remainingNonVNPay === 0 && remainingInstallments === 0) {
      logger.info(
        '\n✅ Migration completed successfully! All records use VNPAY.'
      );
    } else {
      logger.warn(
        '\n⚠️  Migration completed with remaining non-VNPAY records. Please review.'
      );
    }

    // Close connection
    await mongoose.connection.close();
    logger.info('\n👋 Database connection closed.');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run migration
updatePaymentMethodsToVNPay();
