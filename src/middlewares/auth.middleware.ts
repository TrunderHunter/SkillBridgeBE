import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { createErrorResponse } from '../utils/response';
import { logger } from '../utils/logger';

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // First, try to get token from HTTP-only cookie (for web applications)
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
      logger.info('Token found in cookie');
    }
    // If no cookie, try Authorization header (for REST APIs and mobile apps)
    else if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
        logger.info('Token found in Authorization header');
      }
    }

    // No token found in either location
    if (!token) {
      logger.warn(
        `Authentication failed: No token provided - IP: ${req.ip}, Path: ${req.path}`
      );
      return res
        .status(401)
        .json(createErrorResponse('Access denied. No token provided.', 401));
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Check if user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user) {
      logger.warn(
        `Authentication failed: User not found - ID: ${decoded.userId}, IP: ${req.ip}`
      );
      return res
        .status(401)
        .json(createErrorResponse('Invalid token. User not found.', 401));
    }

    if (user.status !== 'active') {
      logger.warn(
        `Authentication failed: User account not active - ID: ${user.id}, Status: ${user.status}, IP: ${req.ip}`
      );
      return res
        .status(401)
        .json(
          createErrorResponse(
            'Account is not active. Please verify your account.',
            401
          )
        );
    }

    // Add user info to request object
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    logger.info(
      `Authentication successful - User ID: ${user.id}, Role: ${user.role}, IP: ${req.ip}`
    );
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn(
        `Authentication failed: Invalid token - IP: ${req.ip}, Error: ${error.message}`
      );
      return res.status(401).json(createErrorResponse('Invalid token.', 401));
    }

    if (error.name === 'TokenExpiredError') {
      logger.warn(
        `Authentication failed: Token expired - IP: ${req.ip}, Expired at: ${error.expiredAt}`
      );
      return res
        .status(401)
        .json(
          createErrorResponse(
            'Token has expired. Please refresh your token.',
            401
          )
        );
    }

    logger.error(
      `Authentication middleware error - IP: ${req.ip}, Error: ${error.message}`,
      {
        error: error.stack,
        path: req.path,
        method: req.method,
      }
    );

    return res
      .status(500)
      .json(
        createErrorResponse('Internal server error during authentication.', 500)
      );
  }
};

// Middleware to check if user has specific role(s)
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      logger.warn(
        `Authorization failed: No user in request - IP: ${req.ip}, Path: ${req.path}`
      );
      return res
        .status(401)
        .json(createErrorResponse('Authentication required.', 401));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(
        `Authorization failed: Insufficient role - User ID: ${req.user.id}, Role: ${req.user.role}, Required: ${roles.join('|')}, IP: ${req.ip}`
      );
      return res
        .status(403)
        .json(
          createErrorResponse('Access denied. Insufficient permissions.', 403)
        );
    }

    logger.info(
      `Authorization successful - User ID: ${req.user.id}, Role: ${req.user.role}, IP: ${req.ip}`
    );
    next();
  };
};

// Middleware to check if user is ADMIN
export const requireAdmin = requireRole('ADMIN');

// Middleware to check if user is TUTOR or ADMIN
export const requireTutorOrAdmin = requireRole('TUTOR', 'ADMIN');

// Optional authentication - doesn't fail if no token, but adds user if valid token
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // Try to get token from cookie first, then header
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.substring(7);
    }

    // If no token, continue without authentication
    if (!token) {
      return next();
    }

    // Try to verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await User.findById(decoded.userId);

    if (user && user.status === 'active') {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      };
      logger.info(
        `Optional authentication successful - User ID: ${user.id}, IP: ${req.ip}`
      );
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens, just continue without user
    logger.info(
      `Optional authentication failed, continuing without user - IP: ${req.ip}, Error: ${(error as Error).message}`
    );
    next();
  }
};
