import express from 'express';
import v1Routes from './v1/index';

const router = express.Router();

router.use('/v1', v1Routes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SkillBridge API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;
