import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { createErrorResponse } from '../utils/response';

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorArray = errors.array();
    const seenFields = new Set();
    const uniqueErrors: any[] = [];

    // Only get the first error for each field
    for (const error of errorArray) {
      const fieldName =
        error.type === 'field' ? (error as any).path : error.type;

      if (!seenFields.has(fieldName)) {
        seenFields.add(fieldName);
        uniqueErrors.push({
          field: fieldName,
          message: error.msg,
        });
      }
    }

    // If there's only 1 error, return the message directly
    if (uniqueErrors.length === 1) {
      res.status(400).json(createErrorResponse(uniqueErrors[0].message, 400));
      return;
    }

    // If there are multiple errors, return the first error's message as main message
    res
      .status(400)
      .json(createErrorResponse(uniqueErrors[0].message, 400, uniqueErrors));
    return;
  }

  next();
};
