import express from 'express';
import { authRoutes } from './auth.routes';
import protectedRoutes from './protected.routes';
import tutorProfileRoutes from './tutorProfile.routes';
import { tutorQualificationRoutes } from './tutor-qualification.routes';
import { adminVerificationRoutes } from './admin-verification.routes';
import addressRoutes from './address.routes';
import subjectRoutes from './subject.routes';
import tutorPostRoutes from './tutorPost.routes';

const router = express.Router();

// Auth routes
router.use('/auth', authRoutes);

// Protected routes (demonstration)
router.use('/protected', protectedRoutes);

// Tutor profile routes
router.use('/tutor', tutorProfileRoutes);

// Tutor qualification routes
router.use('/tutor', tutorQualificationRoutes);

// Admin verification routes
router.use('/admin', adminVerificationRoutes);

// Address routes
router.use('/address', addressRoutes);

// Subject routes
router.use('/subjects', subjectRoutes);

// Tutor post routes
router.use('/tutor-posts', tutorPostRoutes);

export default router;
