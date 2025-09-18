import connectDB from '../config/database';
import { User, TutorProfile } from '../models';
import { UserRole } from '../types/user.types';

/**
 * Migration script to create TutorProfile for existing TUTOR users
 * Run this once to ensure all existing tutors have profiles
 */
async function migrateTutorProfiles() {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database for migration');

    // Find all users with TUTOR role
    const tutorUsers = await User.find({ role: UserRole.TUTOR });
    console.log(`Found ${tutorUsers.length} tutor users`);

    let created = 0;
    let existing = 0;

    for (const user of tutorUsers) {
      // Check if TutorProfile already exists
      const existingProfile = await TutorProfile.findOne({ user_id: user._id });

      if (!existingProfile) {
        // Create new TutorProfile
        const tutorProfile = new TutorProfile({
          user_id: user._id,
          headline: '',
          introduction: '',
          teaching_experience: '',
          student_levels: '',
          video_intro_link: '',
          cccd_images: [],
        });

        await tutorProfile.save();
        created++;
        console.log(
          `Created TutorProfile for user: ${user._id} (${user.full_name})`
        );
      } else {
        existing++;
        console.log(
          `TutorProfile already exists for user: ${user._id} (${user.full_name})`
        );
      }
    }

    console.log(`Migration completed:`);
    console.log(`- Created: ${created} new profiles`);
    console.log(`- Existing: ${existing} profiles`);
    console.log(`- Total tutors: ${tutorUsers.length}`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateTutorProfiles();
}

export { migrateTutorProfiles };
