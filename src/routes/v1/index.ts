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
import { contractRoutes } from './contract.routes';
import messageRoutes from './messageRoutes';
import aiRoutes from './ai.routes';
import assignmentRoutes from './assignment.routes';
import uploadRoutes from './upload.routes';
import notificationRoutes from './notification.routes';
import { paymentRoutes } from './payment.routes';
import sessionReportRoutes from './sessionReport.routes';
import adminSessionReportRoutes from './admin-sessionReport.routes';
import adminUserRoutes from './admin-user.routes';
import adminPaymentRoutes from '../admin-payment.routes';
import webhookRoutes from './webhook.routes';

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
router.use('/admin', adminSessionReportRoutes);
router.use('/admin', adminUserRoutes);
router.use('/admin/payments', adminPaymentRoutes);

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

// Contract routes
router.use('/contracts', contractRoutes);

// Add this line to your router configuration
router.use('/classes', classRoutes);

// Message routes
router.use('/messages', messageRoutes);

// AI routes (smart recommendations, vectorization)
router.use('/ai', aiRoutes);

// Assignment & exercise library routes
router.use('/assignments', assignmentRoutes);

// Upload routes
router.use('/upload', uploadRoutes);

// Notification routes
router.use('/notifications', notificationRoutes);

// Payment routes
router.use('/payments', paymentRoutes);

// Session report routes
router.use('/session-reports', sessionReportRoutes);

// Webhook routes (no auth required - external services)
router.use('/webhooks', webhookRoutes);

export default router;
