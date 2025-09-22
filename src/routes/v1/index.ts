import { Router } from 'express';
import {authRoutes} from './auth.routes';
import protectedRoutes from './protected.routes';
import studentRoutes from './student.routes';

const router = Router();

// ===========================================
// LOGGING MIDDLEWARE - TRACE REQUESTS
// ===========================================
router.use((req, res, next) => {
  next();
});

// ===========================================
// V1 API ROUTES
// ===========================================

router.use('/auth', (req, res, next) => {
  next();
}, authRoutes);

router.use('/protected', (req, res, next) => {
  next();
}, protectedRoutes);

router.use('/students', (req, res, next) => {
  next();
}, studentRoutes);

export default router;
