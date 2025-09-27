import express from 'express';
import { authRoutes } from './auth.routes';
import protectedRoutes from './protected.routes';
import tutorProfileRoutes from './tutorProfile.routes';

const router = express.Router();

// Auth routes
router.use('/auth', authRoutes);

// Protected routes (demonstration)
router.use('/protected', protectedRoutes);

// Tutor profile routes
router.use('/tutor', tutorProfileRoutes);

export default router;
