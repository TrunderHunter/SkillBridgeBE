import express from 'express';
import { authRoutes } from './auth.routes';
import protectedRoutes from './protected.routes';

const router = express.Router();

// Auth routes
router.use('/auth', authRoutes);

// Protected routes (demonstration)
router.use('/protected', protectedRoutes);

export default router;
