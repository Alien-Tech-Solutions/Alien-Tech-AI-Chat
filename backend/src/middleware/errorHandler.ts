import { Request, Response, NextFunction } from 'express';
import { apiLogger as logger } from '../utils/logger';
import { APIError } from '../types';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
    
    // Maintain proper stack trace
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Error handler middleware
 */
export const errorHandler = (
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Don't process if response already sent
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle known API errors
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
  } else {
    // Handle common error types
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      message = error.message;
    } else if (error.name === 'JsonWebTokenError') {
      statusCode = 401;
      errorCode = 'INVALID_TOKEN';
      message = 'Invalid authentication token';
    } else if (error.name === 'TokenExpiredError') {
      statusCode = 401;
      errorCode = 'TOKEN_EXPIRED';
      message = 'Authentication token expired';
    } else if (error.name === 'CastError') {
      statusCode = 400;
      errorCode = 'INVALID_ID';
      message = 'Invalid ID format';
    } else if (error.message.includes('ENOTFOUND')) {
      statusCode = 502;
      errorCode = 'SERVICE_UNAVAILABLE';
      message = 'External service unavailable';
    } else if (error.message.includes('ECONNREFUSED')) {
      statusCode = 503;
      errorCode = 'CONNECTION_REFUSED';
      message = 'Unable to connect to service';
    } else if (error.message.includes('timeout')) {
      statusCode = 504;
      errorCode = 'TIMEOUT';
      message = 'Request timeout';
    }
  }

  // Log error with appropriate level
  const logData = {
    error: errorCode,
    message,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    stack: error.stack,
    details
  };

  if (statusCode >= 500) {
    logger.error('Server error occurred:', logData);
  } else if (statusCode >= 400) {
    logger.warn('Client error occurred:', logData);
  }

  // Create error response
  const errorResponse: APIError = {
    code: errorCode,
    message,
    details: process.env.NODE_ENV === 'production' ? undefined : details,
    timestamp: new Date().toISOString()
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    (errorResponse as any).stack = error.stack;
  }

  res.status(statusCode).json({ error: errorResponse });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const error: APIError = {
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    details: {
      method: req.method,
      path: req.originalUrl
    },
    timestamp: new Date().toISOString()
  };

  logger.warn('Route not found:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  });

  res.status(404).json({ error });
};

/**
 * Async error wrapper utility
 */
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Validation error helper
 */
export const createValidationError = (message: string, details?: any): ApiError => {
  return new ApiError(400, 'VALIDATION_ERROR', message, details);
};

/**
 * Authentication error helper
 */
export const createAuthError = (message: string = 'Authentication required'): ApiError => {
  return new ApiError(401, 'AUTH_REQUIRED', message);
};

/**
 * Authorization error helper
 */
export const createForbiddenError = (message: string = 'Access forbidden'): ApiError => {
  return new ApiError(403, 'ACCESS_FORBIDDEN', message);
};

/**
 * Not found error helper
 */
export const createNotFoundError = (resource: string = 'Resource'): ApiError => {
  return new ApiError(404, 'NOT_FOUND', `${resource} not found`);
};

/**
 * Rate limit error helper
 */
export const createRateLimitError = (message: string = 'Rate limit exceeded'): ApiError => {
  return new ApiError(429, 'RATE_LIMIT_EXCEEDED', message);
};

/**
 * Service unavailable error helper
 */
export const createServiceUnavailableError = (service: string): ApiError => {
  return new ApiError(503, 'SERVICE_UNAVAILABLE', `${service} is currently unavailable`);
};

export default errorHandler; 