import express from 'express';
import { authRoutes } from './auth.routes';
import protectedRoutes from './protected.routes';
import tutorProfileRoutes from './tutorProfile.routes';
import educationRoutes from './education.routes';
import certificatesRoutes from './certificates.routes';
import achievementsRoutes from './achievements.routes';
import verificationRoutes from './verification.routes';

const router = express.Router();

// Auth routes
router.use('/auth', authRoutes);

// Protected routes (demonstration)
router.use('/protected', protectedRoutes);

// Tutor profile routes
router.use('/tutor', tutorProfileRoutes);

// Education routes
router.use('/education', educationRoutes);

// Certificates routes
router.use('/certificates', certificatesRoutes);

// Achievements routes
router.use('/achievements', achievementsRoutes);

// Verification routes
router.use('/verification', verificationRoutes);

export default router;
