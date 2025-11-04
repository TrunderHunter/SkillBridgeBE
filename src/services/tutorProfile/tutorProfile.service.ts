import { TutorProfile } from '../../models/TutorProfile';
import { VerificationStatus } from '../../types/verification.types';
import { logger } from '../../utils/logger';

class TutorProfileService {

  /**
   * Check if tutor can operate (create posts, accept students, etc.)
   * Returns true only if profile status is VERIFIED
   */
  async canTutorOperate(userId: string): Promise<boolean> {
    try {
      const tutorProfile = await TutorProfile.findOne({ user_id: userId });

      if (!tutorProfile) {
        return false;
      }

      return tutorProfile.status === VerificationStatus.VERIFIED;
    } catch (error) {
      logger.error('Check tutor operation permission error:', error);
      return false;
    }
  }

  /**
   * Get tutor profile by user ID
   */
  async getProfileByUserId(userId: string) {
    try {
      const tutorProfile = await TutorProfile.findOne({ user_id: userId });
      return tutorProfile;
    } catch (error) {
      logger.error('Get profile by user ID error:', error);
      return null;
    }
  }

}

export const tutorProfileService = new TutorProfileService();
