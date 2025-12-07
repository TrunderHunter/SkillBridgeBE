/**
 * Script to fix corrupt conversations in database
 * Run with: npx ts-node src/scripts/fix-corrupt-conversations.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillbridge';

async function fixCorruptConversations() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import Conversation model
    const { Conversation } = await import('../models/Conversation');

    // Find all conversations
    console.log('\n🔍 Finding all conversations...');
    const conversations = await Conversation.find({}).lean();
    console.log(`📊 Found ${conversations.length} conversations`);

    let corruptCount = 0;
    let fixedCount = 0;
    const corruptIds: string[] = [];

    for (const conv of conversations) {
      const subject = (conv as any).subject;
      
      // Check if subject is not a valid ObjectId
      if (subject && typeof subject === 'string') {
        // Check if it's a stringified object instead of ObjectId
        if (subject.includes('{') || subject.includes('_id') || subject.includes('name')) {
          console.log(`\n❌ Found corrupt conversation: ${conv._id}`);
          console.log(`   Subject value: ${subject.substring(0, 100)}...`);
          corruptIds.push((conv._id as any).toString());
          corruptCount++;
        }
      }
    }

    if (corruptCount > 0) {
      console.log(`\n⚠️  Found ${corruptCount} corrupt conversations`);
      console.log('🗑️  Deleting corrupt conversations...');
      
      const result = await Conversation.deleteMany({
        _id: { $in: corruptIds }
      });

      fixedCount = result.deletedCount || 0;
      console.log(`✅ Deleted ${fixedCount} corrupt conversations`);
    } else {
      console.log('\n✅ No corrupt conversations found!');
    }

    console.log('\n📊 Summary:');
    console.log(`   Total conversations: ${conversations.length}`);
    console.log(`   Corrupt found: ${corruptCount}`);
    console.log(`   Fixed: ${fixedCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
fixCorruptConversations();
