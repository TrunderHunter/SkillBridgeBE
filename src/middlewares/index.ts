export { errorHandler } from './error.middleware';
export { handleValidationErrors } from './validation.middleware';
export { 
  authenticateToken, 
  requireRole, 
  requireAdmin, 
  requireTutorOrAdmin, 
  optionalAuth 
} from './auth.middleware';

export {requireStudentRole} from './student.middleware'
