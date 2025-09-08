import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to SkillBridge API v1',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Health check route
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running smoothly',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

export default router;
