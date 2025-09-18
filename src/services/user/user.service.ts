import { User, TutorProfile } from '../../models';
import { IUserInput, UserRole } from '../../types/user.types';

export class UserService {
  // Create user and auto-create TutorProfile if role is TUTOR
  static async createUser(userData: IUserInput): Promise<any> {
    try {
      // Create user first
      const user = new User(userData);
      await user.save();

      // If user is TUTOR, create TutorProfile automatically
      if (user.role === UserRole.TUTOR) {
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
        console.log(`TutorProfile created for new tutor: ${user._id}`);
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  // Update user role and create/delete TutorProfile accordingly
  static async updateUserRole(userId: string, newRole: UserRole): Promise<any> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const oldRole = user.role;
      user.role = newRole;
      await user.save();

      // If changing TO tutor role, create TutorProfile
      if (newRole === UserRole.TUTOR && oldRole !== UserRole.TUTOR) {
        const existingProfile = await TutorProfile.findOne({ user_id: userId });
        if (!existingProfile) {
          const tutorProfile = new TutorProfile({
            user_id: userId,
            headline: '',
            introduction: '',
            teaching_experience: '',
            student_levels: '',
            video_intro_link: '',
            cccd_images: [],
          });
          await tutorProfile.save();
          console.log(`TutorProfile created for role change: ${userId}`);
        }
      }

      // If changing FROM tutor role, optionally delete TutorProfile
      // (Comment out if you want to keep the data)
      /*
      if (oldRole === UserRole.TUTOR && newRole !== UserRole.TUTOR) {
        await TutorProfile.findOneAndDelete({ user_id: userId });
        console.log(`TutorProfile deleted for role change: ${userId}`);
      }
      */

      return user;
    } catch (error) {
      throw error;
    }
  }
}
