import { Router } from 'express';
import { CertificateController } from '../../controllers/education';
import { upload } from '../../config/cloudinary';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { handleValidationErrors } from '../../middlewares/validation.middleware';
import {
  createCertificateValidator,
  updateCertificateValidator,
  certificateParamsValidator,
} from '../../validators/certificate.validator';

const router = Router();

// All certificate routes require authentication
router.use(authenticateToken);

// GET /certificates - Get tutor's certificates
router.get('/', CertificateController.getCertificates);

// GET /certificates/:certificateId - Get certificate by ID
router.get(
  '/:certificateId',
  certificateParamsValidator,
  handleValidationErrors,
  CertificateController.getCertificateById
);

// POST /certificates - Create certificate record
router.post(
  '/',
  upload.single('certificateImage'), // Field name for certificate image upload
  createCertificateValidator,
  handleValidationErrors,
  CertificateController.createCertificate
);

// PUT /certificates/:certificateId - Update certificate record
router.put(
  '/:certificateId',
  upload.single('certificateImage'), // Field name for certificate image upload
  updateCertificateValidator,
  handleValidationErrors,
  CertificateController.updateCertificate
);

// DELETE /certificates/:certificateId - Delete certificate record
router.delete(
  '/:certificateId',
  certificateParamsValidator,
  handleValidationErrors,
  CertificateController.deleteCertificate
);

export default router;
