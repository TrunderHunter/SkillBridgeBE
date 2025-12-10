/**
 * Migration script to populate violatorUserIds in existing SessionReports
 * This script should be run once after deploying the new schema
 *
 * Run with: npx ts-node src/scripts/migrate-violator-userids.ts
 */

import mongoose from 'mongoose';
import SessionReport from '../models/SessionReport';
import { LearningClass } from '../models';
import { logger } from '../utils/logger';

async function migrateViolatorUserIds() {
  try {
    // Connect to database
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/skillbridge';
    await mongoose.connect(mongoUri);
    logger.info('Connected to database');

    // Find all resolved reports without violatorUserIds
    const reportsToUpdate = await SessionReport.find({
      status: 'RESOLVED',
      'resolution.decision': {
        $in: ['STUDENT_FAULT', 'TUTOR_FAULT', 'BOTH_FAULT'],
      },
      $or: [
        { violatorUserIds: { $exists: false } },
        { violatorUserIds: [] },
        { violatorUserIds: null },
      ],
    }).lean();

    logger.info(`Found ${reportsToUpdate.length} reports to migrate`);

    let successCount = 0;
    let errorCount = 0;

    for (const report of reportsToUpdate) {
      try {
        // Get the learning class to find student and tutor IDs
        const learningClass = await LearningClass.findById(report.classId);

        if (!learningClass) {
          logger.warn(`Class not found for report ${report._id}`);
          errorCount++;
          continue;
        }

        const studentId = learningClass.studentId.toString();
        const tutorId = learningClass.tutorId.toString();

        // Determine violators based on decision
        const violatorUserIds: string[] = [];
        const decision = report.resolution?.decision;

        switch (decision) {
          case 'STUDENT_FAULT':
            violatorUserIds.push(studentId);
            break;
          case 'TUTOR_FAULT':
            violatorUserIds.push(tutorId);
            break;
          case 'BOTH_FAULT':
            violatorUserIds.push(studentId, tutorId);
            break;
        }

        // Update the report
        await SessionReport.updateOne(
          { _id: report._id },
          {
            $set: {
              violatorUserIds,
              'resolution.violatorUserIds': violatorUserIds,
            },
          }
        );

        successCount++;

        if (successCount % 100 === 0) {
          logger.info(
            `Migrated ${successCount}/${reportsToUpdate.length} reports`
          );
        }
      } catch (error) {
        logger.error(`Error migrating report ${report._id}:`, error);
        errorCount++;
      }
    }

    logger.info('Migration completed!');
    logger.info(`Success: ${successCount}, Errors: ${errorCount}`);

    // Create index if not exists
    logger.info('Creating indexes...');
    await SessionReport.collection.createIndex({ violatorUserIds: 1 });
    logger.info('Indexes created');

    await mongoose.disconnect();
    logger.info('Disconnected from database');

    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateViolatorUserIds();
