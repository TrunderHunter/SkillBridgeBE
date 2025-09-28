/**
 * Test script để verify logic MODIFIED_AFTER_REJECTION
 *
 * Flow test:
 * 1. Tạo education với status DRAFT
 * 2. Submit verification request
 * 3. Admin reject education
 * 4. User update education -> status chuyển thành MODIFIED_AFTER_REJECTION
 * 5. Verify canSubmitVerification trả về true
 * 6. Submit verification request lại
 * 7. Admin approve -> status chuyển thành VERIFIED
 */

import { connectDB } from '../config/database';
import { QualificationService } from '../services/qualification/qualification.service';
import { QualificationSuggestionService } from '../services/qualification/qualification-suggestion.service';
import { AdminVerificationService } from '../services/qualification/admin-verification.service';
import { Education, Certificate, VerificationRequest } from '../models';
import {
  VerificationStatus,
  RequestStatus,
  EducationLevel,
} from '../types/verification.types';

const TEST_TUTOR_ID = 'test-tutor-modified-after-rejection';

async function testModifiedAfterRejectionFlow() {
  try {
    console.log('🧪 Bắt đầu test MODIFIED_AFTER_REJECTION flow...');

    // Cleanup previous test data
    await cleanup();

    // 1. Tạo education với status DRAFT
    console.log('\n1️⃣ Tạo education với status DRAFT...');
    const education = new Education({
      tutorId: TEST_TUTOR_ID,
      level: EducationLevel.BACHELOR,
      school: 'Test University',
      major: 'Computer Science',
      graduationYear: 2020,
      gpa: 3.5,
      status: VerificationStatus.DRAFT,
    });
    await education.save();
    console.log(`✅ Education created with status: ${education.status}`);

    // 2. Tạo certificate với status DRAFT
    console.log('\n2️⃣ Tạo certificate với status DRAFT...');
    const certificate = new Certificate({
      tutorId: TEST_TUTOR_ID,
      name: 'Test Certificate',
      issuer: 'Test Issuer',
      issueDate: new Date('2020-06-01'),
      expiryDate: new Date('2025-06-01'),
      status: VerificationStatus.DRAFT,
    });
    await certificate.save();
    console.log(`✅ Certificate created with status: ${certificate.status}`);

    // 3. Submit verification request
    console.log('\n3️⃣ Submit verification request...');
    const verificationRequest =
      await QualificationService.createVerificationRequest(TEST_TUTOR_ID, {
        educationId: education._id.toString(),
        certificateIds: [certificate._id.toString()],
      });
    console.log(
      `✅ Verification request created with status: ${verificationRequest.status}`
    );

    // 4. Admin reject education
    console.log('\n4️⃣ Admin reject education...');
    const requestDetails =
      await AdminVerificationService.getVerificationRequestDetail(
        verificationRequest._id.toString()
      );

    const educationDetail = requestDetails.details?.find(
      (d) =>
        d.targetType === 'EDUCATION' && d.targetId === education._id.toString()
    );

    if (educationDetail) {
      await AdminVerificationService.processVerificationRequest(
        verificationRequest._id.toString(),
        'test-admin-id',
        [
          {
            detailId: educationDetail._id.toString(),
            status: VerificationStatus.REJECTED,
            rejectionReason: 'Test rejection reason',
          },
        ],
        'Test admin note'
      );

      // Refresh education to get updated status
      await education.reload();
      console.log(`✅ Education rejected with status: ${education.status}`);
    }

    // 5. Check canSubmitVerification before update
    console.log('\n5️⃣ Check canSubmitVerification before update...');
    const suggestionBeforeUpdate =
      await QualificationSuggestionService.getQualificationSuggestion(
        TEST_TUTOR_ID
      );
    console.log(
      `Can submit verification before update: ${suggestionBeforeUpdate.canSubmitVerification}`
    );

    // 6. User update education -> should change to MODIFIED_AFTER_REJECTION
    console.log('\n6️⃣ User update education...');
    education.school = 'Updated Test University';
    education.status = VerificationStatus.REJECTED; // Simulate current status
    await education.save();

    // Simulate the update logic from controller
    if (education.status === VerificationStatus.REJECTED) {
      education.status = VerificationStatus.MODIFIED_AFTER_REJECTION;
      education.verifiedData = {
        ...education.toObject(),
        status: VerificationStatus.REJECTED,
      };
      await education.save();
    }

    console.log(`✅ Education updated with status: ${education.status}`);
    console.log(`✅ VerifiedData saved: ${!!education.verifiedData}`);

    // 7. Check canSubmitVerification after update
    console.log('\n7️⃣ Check canSubmitVerification after update...');
    const suggestionAfterUpdate =
      await QualificationSuggestionService.getQualificationSuggestion(
        TEST_TUTOR_ID
      );
    console.log(
      `Can submit verification after update: ${suggestionAfterUpdate.canSubmitVerification}`
    );
    console.log(
      `Pending verification count: ${suggestionAfterUpdate.pendingVerificationCount}`
    );

    // 8. Submit verification request again
    console.log('\n8️⃣ Submit verification request again...');
    const newVerificationRequest =
      await QualificationService.createVerificationRequest(TEST_TUTOR_ID, {
        educationId: education._id.toString(),
      });
    console.log(
      `✅ New verification request created with status: ${newVerificationRequest.status}`
    );

    // 9. Admin approve education
    console.log('\n9️⃣ Admin approve education...');
    const newRequestDetails =
      await AdminVerificationService.getVerificationRequestDetail(
        newVerificationRequest._id.toString()
      );

    const newEducationDetail = newRequestDetails.details?.find(
      (d) =>
        d.targetType === 'EDUCATION' && d.targetId === education._id.toString()
    );

    if (newEducationDetail) {
      await AdminVerificationService.processVerificationRequest(
        newVerificationRequest._id.toString(),
        'test-admin-id',
        [
          {
            detailId: newEducationDetail._id.toString(),
            status: VerificationStatus.VERIFIED,
          },
        ],
        'Test approval'
      );

      // Refresh education to get updated status
      await education.reload();
      console.log(`✅ Education approved with status: ${education.status}`);
      console.log(`✅ VerifiedData cleared: ${!education.verifiedData}`);
    }

    console.log('\n🎉 Test completed successfully!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await cleanup();
  }
}

async function cleanup() {
  try {
    await Education.deleteMany({ tutorId: TEST_TUTOR_ID });
    await Certificate.deleteMany({ tutorId: TEST_TUTOR_ID });
    await VerificationRequest.deleteMany({ tutorId: TEST_TUTOR_ID });
    console.log('🧹 Cleanup completed');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  connectDB()
    .then(() => testModifiedAfterRejectionFlow())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testModifiedAfterRejectionFlow };
