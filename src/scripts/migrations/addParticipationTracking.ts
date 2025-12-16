import mongoose from 'mongoose';
import LearningClass from '../../models/LearningClass';
import { logger } from '../../utils/logger';

/**
 * Migration script to add participation tracking to existing learning classes
 * Run this once to initialize participation data structure for existing sessions
 */
async function migrateToParticipationTracking() {
  try {
    logger.info('Starting migration to add participation tracking...');

    // Connect to database
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      throw new Error('MONGO_URI not found in environment');
    }

    await mongoose.connect(MONGO_URI);
    logger.info('Connected to MongoDB');

    // Find all learning classes
    const classes = await LearningClass.find({});
    logger.info(`Found ${classes.length} learning classes to migrate`);

    let updatedCount = 0;

    for (const learningClass of classes) {
      let needsUpdate = false;

      // Update each session to add participation structure
      for (const session of learningClass.sessions) {
        // Only add participation if it doesn't exist
        if (!session.participation) {
          (session as any).participation = {
            tutorDuration: 0,
            tutorJoinCount: 0,
            studentDuration: 0,
            studentJoinCount: 0,
            bothParticipated: false,
          };

          // Migrate old attendance data to participation if exists
          if (session.attendance) {
            // If both attended in old system, mark as participated
            if (session.attendance.tutorAttended && session.attendance.studentAttended) {
              (session as any).participation.bothParticipated = true;
              (session as any).participation.tutorJoinedAt = session.attendance.tutorAttendedAt;
              (session as any).participation.studentJoinedAt = session.attendance.studentAttendedAt;
              
              // Estimate duration based on session duration if completed
              if (session.status === 'COMPLETED') {
                (session as any).participation.tutorDuration = session.duration || 0;
                (session as any).participation.studentDuration = session.duration || 0;
                (session as any).participation.completedAt = session.actualEndTime || new Date();
              }
            }
          }

          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await learningClass.save();
        updatedCount++;
        
        if (updatedCount % 10 === 0) {
          logger.info(`Migrated ${updatedCount} classes...`);
        }
      }
    }

    logger.info(`✅ Migration completed! Updated ${updatedCount} learning classes`);
    
    // Close connection
    await mongoose.connection.close();
    logger.info('Database connection closed');
    
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateToParticipationTracking();
