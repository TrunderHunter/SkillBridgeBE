import express from 'express';
import { authRoutes } from './auth.routes';
import protectedRoutes from './protected.routes';
import tutorProfileRoutes from './tutorProfile.routes';
import studentProfileRoutes from './studentProfile.routes'; 
import { tutorQualificationRoutes } from './tutor-qualification.routes';
import { adminVerificationRoutes } from './admin-verification.routes';
import addressRoutes from './address.routes';
import subjectRoutes from './subject.routes';
import tutorPostRoutes from './tutorPost.routes';
import postRoutes from './post.routes';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/protected', protectedRoutes);
router.use('/tutor', tutorProfileRoutes);
router.use('/student', studentProfileRoutes); 
router.use('/tutor', tutorQualificationRoutes);
router.use('/admin', adminVerificationRoutes);
router.use('/posts', postRoutes);

// Address routes
router.use('/address', addressRoutes);

// Subject routes
router.use('/subjects', subjectRoutes);

// Tutor post routes
router.use('/tutor-posts', tutorPostRoutes);

export default router;
