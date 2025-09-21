import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';

export const initializeSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Middleware for authentication
  io.use((socket, next) => {
    // TODO: Add authentication logic here
    // const token = socket.handshake.auth.token;
    // Verify JWT token and attach user info to socket
    logger.info(`Socket connected: ${socket.id}`);
    next();
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.id}`);

    // Join user to their personal notification room
    socket.on('join-notifications', (userId: string) => {
      if (userId) {
        socket.join(`notifications-${userId}`);
        logger.info(`User ${userId} joined notifications room`);
      }
    });

    // Handle notification acknowledgment
    socket.on('notification-read', (notificationId: string) => {
      logger.info(`Notification ${notificationId} marked as read`);
      // TODO: Update notification status in database
    });

    socket.on('disconnect', (reason) => {
      logger.info(`User disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  return io;
};

// Export socket instance for use in other modules
let socketInstance: Server | null = null;

export const setSocketInstance = (io: Server) => {
  socketInstance = io;
};

export const getSocketInstance = (): Server | null => {
  return socketInstance;
};
