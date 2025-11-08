import mongoose from 'mongoose';
import { LearningClass } from '../models/LearningClass';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script to fix scheduledDate times for existing sessions
 * Problem: Old sessions have scheduledDate at 00:00:00, need to set correct time from schedule
 */
async function fixSessionTimes() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skillbridge');
    logger.info('Connected to MongoDB');

    // Get all learning classes with sessions
    const classes = await LearningClass.find({
      'sessions.0': { $exists: true } // Has at least 1 session
    });

    logger.info(`Found ${classes.length} classes with sessions`);

    let updatedCount = 0;
    let totalSessions = 0;

    for (const learningClass of classes) {
      const [startHour, startMinute] = learningClass.schedule.startTime.split(':').map(Number);
      let hasChanges = false;

      for (const session of learningClass.sessions) {
        totalSessions++;
        
        const sessionDate = new Date(session.scheduledDate);
        
        // Check if time is midnight (00:00:00) - likely needs fixing
        if (sessionDate.getHours() === 0 && sessionDate.getMinutes() === 0 && sessionDate.getSeconds() === 0) {
          // Set correct time from schedule
          sessionDate.setHours(startHour, startMinute, 0, 0);
          session.scheduledDate = sessionDate;
          hasChanges = true;
          
          logger.info(`Fixed session ${session.sessionNumber} for class ${learningClass._id}: ${sessionDate.toISOString()}`);
        }
      }

      if (hasChanges) {
        await learningClass.save();
        updatedCount++;
      }
    }

    logger.info(`✅ Migration complete!`);
    logger.info(`   - Total classes: ${classes.length}`);
    logger.info(`   - Total sessions: ${totalSessions}`);
    logger.info(`   - Classes updated: ${updatedCount}`);

  } catch (error) {
    logger.error('Migration error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run migration
fixSessionTimes()
  .then(() => {
    logger.info('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  });
