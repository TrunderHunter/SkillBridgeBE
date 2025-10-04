import { Request } from 'express';
import { ITutorProfileDocument } from '../models/TutorProfile';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        status: string;
      };
      tutorProfile?: ITutorProfileDocument;
    }
  }
}

export {};
