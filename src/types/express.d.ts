import { UserRole, UserStatus } from './user.types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        status: UserStatus;
        iat?: number;
        exp?: number;
      };
    }
  }
}

export {};
