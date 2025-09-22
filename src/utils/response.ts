import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  success: boolean,
  message: string,
  data?: T,
  error?: string
): void => {
  const response: ApiResponse<T> = {
    success,
    message,
  };

  if (data !== undefined) {
    response.data = data;
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

export const sendError = (
  res: Response,
  message: string,
  error?: string,
  statusCode: number = 400
): void => {
  sendResponse(res, statusCode, false, message, undefined, error);
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

export const createSuccessResponse = <T>(
  data?: T,
  message: string = 'Thành công',
  statusCode: number = 200
) => ({
  success: true,
  message,
  statusCode,
  data,
});
