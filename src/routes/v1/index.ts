import express from 'express';
import { authRoutes } from './auth.routes';
import protectedRoutes from './protected.routes';
import tutorProfileRoutes from './tutorProfile.routes';
import { tutorQualificationRoutes } from './tutor-qualification.routes';
import { adminVerificationRoutes } from './admin-verification.routes';
import postRoutes from './post.routes';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/protected', protectedRoutes);
router.use('/tutor/profile', tutorProfileRoutes);
router.use('/tutor/qualification', tutorQualificationRoutes);
router.use('/admin/verification', adminVerificationRoutes);
router.use('/posts', postRoutes);

export default router;
