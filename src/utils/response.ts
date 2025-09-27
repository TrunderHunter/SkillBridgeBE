import { Response } from 'express';

export interface QualificationInfo {
  isQualified: boolean;
  canSubmitVerification: boolean;
  hasChangesNeedVerification: boolean;
  pendingVerificationCount: number;
  missingRequirements: string[];
  suggestion: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  qualification?: QualificationInfo;
  error?: string;
}

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  success: boolean,
  message: string,
  data?: T,
  qualification?: QualificationInfo,
  error?: string
): void => {
  const response: ApiResponse<T> = {
    success,
    message,
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (qualification) {
    response.qualification = qualification;
  }

  if (error) {
    response.error = error;
  }

  res.status(statusCode).json(response);
};

export const sendSuccess = <T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200
): void => {
  sendResponse(res, statusCode, true, message, data);
};

export const sendSuccessWithQualification = <T>(
  res: Response,
  message: string,
  data?: T,
  qualification?: QualificationInfo,
  statusCode: number = 200
): void => {
  sendResponse(res, statusCode, true, message, data, qualification);
};

export const sendError = (
  res: Response,
  message: string,
  error?: string,
  statusCode: number = 400
): void => {
  sendResponse(res, statusCode, false, message, undefined, undefined, error);
};

export const createErrorResponse = (
  message: string,
  statusCode: number = 400,
  data?: any
) => ({
  success: false,
  message,
  statusCode,
  data,
});

export class ApiError extends Error {
  public statusCode: number;
  public data?: any;

  constructor(statusCode: number, message: string, data?: any) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
    this.name = 'ApiError';
  }
}
