import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Contract } from '../models/Contract';

dotenv.config();

async function cleanupIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/test'
    );
    console.log('Connected to MongoDB');

    // Get all current indexes
    const indexes = await Contract.collection.getIndexes();
    console.log('Current indexes:', Object.keys(indexes));

    // List of outdated/duplicate indexes to drop
    const indexesToDrop = [
      'tutorId_1_studentId_1', // Not needed
      'status_1', // Duplicate (covered by compound indexes)
      'postId_1', // Field doesn't exist (old schema)
      'createdAt_-1', // Duplicate (covered by compound indexes)
    ];

    for (const indexName of indexesToDrop) {
      try {
        await Contract.collection.dropIndex(indexName);
        console.log(`✅ Dropped index: ${indexName}`);
      } catch (error: any) {
        if (error.code === 27 || error.message.includes('index not found')) {
          console.log(`ℹ️  Index ${indexName} does not exist`);
        } else {
          console.log(`⚠️  Could not drop index ${indexName}:`, error.message);
        }
      }
    }

    // Show remaining indexes
    const remainingIndexes = await Contract.collection.getIndexes();
    console.log('\nRemaining indexes:', Object.keys(remainingIndexes));

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('Error cleaning up indexes:', error);
    process.exit(1);
  }
}

cleanupIndexes();
