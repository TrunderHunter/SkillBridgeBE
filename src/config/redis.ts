import { createClient } from 'redis';
import { logger } from '../utils/logger';

// Create Redis client
export const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD,
  database: 0,
});

// Handle Redis connection events
redisClient.on('connect', () => {
  logger.info('✅ Redis client connected');
});

redisClient.on('ready', () => {
  logger.info('✅ Redis client ready');
});

redisClient.on('error', (err) => {
  logger.error('❌ Redis client error:', err);
});

redisClient.on('end', () => {
  logger.warn('⚠️ Redis client disconnected');
});

// Connect to Redis
export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    logger.info('🔗 Redis connection established');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.quit();
    logger.info('🔌 Redis connection closed gracefully');
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
};

export default redisClient;
