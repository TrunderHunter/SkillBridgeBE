/**
 * Script để kiểm tra participation tracking data trong database
 *
 * Usage:
 * node scripts/check-participation.js <classId> <sessionNumber>
 *
 * Example:
 * node scripts/check-participation.js 9b1ccdh9-e4c1-4a89-a36d-cae1bc073664 1
 */

require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// LearningClass Schema (simplified)
const learningClassSchema = new mongoose.Schema(
  {
    tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutor' },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    sessions: [
      {
        sessionNumber: Number,
        status: String,
        actualStartTime: Date,
        actualEndTime: Date,
        attendance: {
          tutorMarkedAt: Date,
          studentMarkedAt: Date,
          bothMarked: Boolean,
        },
        participation: {
          tutorJoinedAt: Date,
          tutorLeftAt: Date,
          tutorDuration: Number,
          tutorJoinCount: Number,
          studentJoinedAt: Date,
          studentLeftAt: Date,
          studentDuration: Number,
          studentJoinCount: Number,
          bothParticipated: Boolean,
          completedAt: Date,
          recording: {
            enabled: Boolean,
            recordingUrl: String,
            recordingDuration: Number,
            recordingSize: Number,
            status: String,
            recordingStartedAt: Date,
            recordingEndedAt: Date,
          },
        },
      },
    ],
  },
  { timestamps: true }
);

const LearningClass = mongoose.model('LearningClass', learningClassSchema);

// Main function
const checkParticipation = async (classId, sessionNumber) => {
  try {
    console.log('\n🔍 Checking participation data...\n');
    console.log(`Class ID: ${classId}`);
    console.log(`Session Number: ${sessionNumber}\n`);

    // Find class
    const learningClass = await LearningClass.findById(classId)
      .populate('tutorId', 'fullName email')
      .populate('studentId', 'fullName email');

    if (!learningClass) {
      console.log('❌ Class not found!');
      return;
    }

    console.log('✅ Class found:');
    console.log(
      `- Tutor: ${learningClass.tutorId?.fullName || 'N/A'} (${learningClass.tutorId?.email})`
    );
    console.log(
      `- Student: ${learningClass.studentId?.fullName || 'N/A'} (${learningClass.studentId?.email})`
    );

    // Find session
    const session = learningClass.sessions.find(
      (s) => s.sessionNumber === parseInt(sessionNumber)
    );

    if (!session) {
      console.log(`\n❌ Session ${sessionNumber} not found!`);
      return;
    }

    console.log(`\n📅 Session ${sessionNumber} Details:`);
    console.log(`- Status: ${session.status}`);
    console.log(`- Actual Start: ${session.actualStartTime || 'Not started'}`);
    console.log(`- Actual End: ${session.actualEndTime || 'Not ended'}`);

    // Check attendance (OLD system)
    if (session.attendance) {
      console.log('\n📋 Attendance (OLD SYSTEM - deprecated):');
      console.log(
        `- Tutor marked: ${session.attendance.tutorMarkedAt || 'No'}`
      );
      console.log(
        `- Student marked: ${session.attendance.studentMarkedAt || 'No'}`
      );
      console.log(
        `- Both marked: ${session.attendance.bothMarked ? 'Yes' : 'No'}`
      );
    }

    // Check participation (NEW system)
    if (session.participation) {
      console.log('\n🎯 Participation (NEW SYSTEM - tracking):');

      console.log('\n👨‍🏫 TUTOR:');
      console.log(
        `- Joined at: ${session.participation.tutorJoinedAt || '❌ Not joined yet'}`
      );
      console.log(
        `- Left at: ${session.participation.tutorLeftAt || 'Still in meeting'}`
      );
      console.log(
        `- Duration: ${session.participation.tutorDuration || 0} minutes`
      );
      console.log(`- Join count: ${session.participation.tutorJoinCount || 0}`);

      console.log('\n👨‍🎓 STUDENT:');
      console.log(
        `- Joined at: ${session.participation.studentJoinedAt || '❌ Not joined yet'}`
      );
      console.log(
        `- Left at: ${session.participation.studentLeftAt || 'Still in meeting'}`
      );
      console.log(
        `- Duration: ${session.participation.studentDuration || 0} minutes`
      );
      console.log(
        `- Join count: ${session.participation.studentJoinCount || 0}`
      );

      console.log('\n✅ COMPLETION:');
      console.log(
        `- Both participated: ${session.participation.bothParticipated ? '✅ Yes' : '❌ No'}`
      );
      console.log(
        `- Completed at: ${session.participation.completedAt || 'Not completed'}`
      );

      // Calculate required duration (50% of 90 minutes = 45 minutes)
      const requiredDuration = 45; // 50% of 90 minutes
      const tutorDuration = session.participation.tutorDuration || 0;
      const studentDuration = session.participation.studentDuration || 0;

      console.log('\n📊 Duration Analysis:');
      console.log(`- Required: ${requiredDuration} minutes (50%)`);
      console.log(
        `- Tutor: ${tutorDuration}/${requiredDuration} minutes ${tutorDuration >= requiredDuration ? '✅' : '❌'}`
      );
      console.log(
        `- Student: ${studentDuration}/${requiredDuration} minutes ${studentDuration >= requiredDuration ? '✅' : '❌'}`
      );

      // Recording
      if (session.participation.recording) {
        console.log('\n🎥 RECORDING:');
        console.log(
          `- Enabled: ${session.participation.recording.enabled ? 'Yes' : 'No'}`
        );
        console.log(
          `- Status: ${session.participation.recording.status || 'N/A'}`
        );
        console.log(
          `- URL: ${session.participation.recording.recordingUrl || 'No URL yet'}`
        );
        console.log(
          `- Duration: ${session.participation.recording.recordingDuration || 0} minutes`
        );
        console.log(
          `- Started: ${session.participation.recording.recordingStartedAt || 'N/A'}`
        );
      }
    } else {
      console.log('\n⚠️ No participation data found!');
      console.log('This means tracking has not been triggered yet.');
    }

    console.log('\n' + '='.repeat(60));
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
};

// Run script
const run = async () => {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(
      'Usage: node scripts/check-participation.js <classId> <sessionNumber>'
    );
    console.log(
      'Example: node scripts/check-participation.js 9b1ccdh9-e4c1-4a89-a36d-cae1bc073664 1'
    );
    process.exit(1);
  }

  const [classId, sessionNumber] = args;

  await connectDB();
  await checkParticipation(classId, sessionNumber);

  mongoose.connection.close();
  console.log('\n✅ Done!');
};

run().catch((error) => {
  console.error('Script error:', error);
  process.exit(1);
});
