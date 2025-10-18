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
import contactRequestRoutes from './contactRequest.routes'; 
// Add this import to your existing imports
import classRoutes from './class.routes';

const router = express.Router();

// Authentication routes
router.use('/auth', authRoutes);

// Protected routes (general)
router.use('/protected', protectedRoutes);

// Profile routes
router.use('/tutor', tutorProfileRoutes);
router.use('/student', studentProfileRoutes); 

// Qualification routes
router.use('/tutor', tutorQualificationRoutes);

// Admin routes
router.use('/admin', adminVerificationRoutes);

// Post routes
router.use('/posts', postRoutes);

// Address routes
router.use('/address', addressRoutes);

// Subject routes
router.use('/subjects', subjectRoutes);

// Tutor post routes
router.use('/tutor-posts', tutorPostRoutes);

// ✅ Contact request routes
router.use('/contact-requests', contactRequestRoutes);

// Add this line to your router configuration
router.use('/classes', classRoutes);

export default router;
