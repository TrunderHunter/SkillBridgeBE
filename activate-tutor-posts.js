// Update all tutor posts to ACTIVE status
require('dotenv').config();
const mongoose = require('mongoose');

async function activate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const TutorPost = mongoose.model(
      'TutorPost',
      new mongoose.Schema({}, { strict: false, collection: 'tutor_posts' })
    );

    // Check current status
    const beforeCount = await TutorPost.countDocuments();
    const activeCount = await TutorPost.countDocuments({ status: 'ACTIVE' });

    console.log('📊 BEFORE UPDATE:');
    console.log('  Total posts:', beforeCount);
    console.log('  ACTIVE posts:', activeCount);
    console.log('');

    // Get all posts to see their current status
    const allPosts = await TutorPost.find({}).lean();
    console.log('📋 CURRENT STATUS:');
    allPosts.forEach((post, idx) => {
      console.log(`  ${idx + 1}. ${post.title} - Status: ${post.status}`);
    });
    console.log('');

    // Update all to ACTIVE
    const result = await TutorPost.updateMany(
      {}, // All documents
      { $set: { status: 'ACTIVE' } }
    );

    console.log('🔄 UPDATE RESULT:');
    console.log('  Modified count:', result.modifiedCount);
    console.log('');

    // Check after update
    const afterActiveCount = await TutorPost.countDocuments({
      status: 'ACTIVE',
    });
    console.log('✅ AFTER UPDATE:');
    console.log('  ACTIVE posts:', afterActiveCount);
    console.log('');

    if (afterActiveCount > 0) {
      console.log('✅ SUCCESS! All tutor posts are now ACTIVE');
      console.log('💡 Now run: node debug-filters.js');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

activate();
