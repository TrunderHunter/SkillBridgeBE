import 'module-alias/register';
import http from 'http';
import app from './app';
import { connectDB, initializeSocket, setSocketInstance } from './config/index';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3000;

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`📱 Received ${signal}. Starting graceful shutdown...`);

  try {
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.IO
    const io = initializeSocket(server);
    setSocketInstance(io);

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🌐 API URL: http://localhost:${PORT}/api/v1`);
      logger.info(`⚡ Socket.IO initialized`);
      logger.info(`🔔 Notification service ready`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle graceful shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
