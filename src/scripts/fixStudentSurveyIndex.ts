import mongoose from 'mongoose';
import { config } from 'dotenv';
import { logger } from '../utils/logger';
import { StudentSurvey } from '../models/StudentSurvey';

config();

/**
 * Script to fix StudentSurvey index issue
 * Remove old unique index on studentId and create proper compound index
 */
async function fixStudentSurveyIndex() {
  try {
    logger.info('🔧 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skillbridge');
    
    logger.info('✅ Connected to MongoDB');
    
    const collection = StudentSurvey.collection;
    
    // 1. List current indexes
    logger.info('📊 Current indexes:');
    const indexes = await collection.getIndexes();
    console.log(JSON.stringify(indexes, null, 2));
    
    // 2. Drop the problematic unique index on studentId if it exists
    try {
      logger.info('🗑️  Attempting to drop studentId_1 index...');
      await collection.dropIndex('studentId_1');
      logger.info('✅ Successfully dropped studentId_1 unique index');
    } catch (error: any) {
      if (error.code === 27 || error.message.includes('index not found')) {
        logger.info('ℹ️  Index studentId_1 does not exist (already removed)');
      } else {
        logger.error('❌ Error dropping index:', error.message);
      }
    }
    
    // 3. Ensure proper indexes exist
    logger.info('🔨 Ensuring proper indexes...');
    
    // This should already exist from schema, but let's verify
    await collection.createIndex({ studentId: 1, isActive: 1 }, { background: true });
    logger.info('✅ Ensured compound index: { studentId: 1, isActive: 1 }');
    
    await collection.createIndex({ createdAt: -1 }, { background: true });
    logger.info('✅ Ensured index: { createdAt: -1 }');
    
    // 4. List final indexes
    logger.info('📊 Final indexes:');
    const finalIndexes = await collection.getIndexes();
    console.log(JSON.stringify(finalIndexes, null, 2));
    
    logger.info('✅ Index fix completed successfully!');
    
  } catch (error: any) {
    logger.error('❌ Error fixing indexes:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    logger.info('👋 Database connection closed');
  }
}

// Run the script
fixStudentSurveyIndex()
  .then(() => {
    logger.info('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  });
