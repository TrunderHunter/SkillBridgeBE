import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Contract } from '../models/Contract';

dotenv.config();

async function dropContractIdIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/test'
    );
    console.log('Connected to MongoDB');

    // Get all indexes
    const indexes = await Contract.collection.getIndexes();
    console.log('Current indexes:', Object.keys(indexes));

    // Drop the contractId_1 index if it exists
    try {
      await Contract.collection.dropIndex('contractId_1');
      console.log('✅ Successfully dropped contractId_1 index');
    } catch (error: any) {
      if (error.code === 27 || error.message.includes('index not found')) {
        console.log(
          'ℹ️  contractId_1 index does not exist (already dropped or never existed)'
        );
      } else {
        throw error;
      }
    }

    // Show remaining indexes
    const remainingIndexes = await Contract.collection.getIndexes();
    console.log('Remaining indexes:', Object.keys(remainingIndexes));

    await mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error dropping index:', error);
    process.exit(1);
  }
}

dropContractIdIndex();
