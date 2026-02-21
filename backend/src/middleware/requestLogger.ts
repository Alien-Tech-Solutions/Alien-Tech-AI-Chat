import { Request, Response, NextFunction } from 'express';
import { perfLogger, apiLogger } from '../utils/logger';

/**
 * Extended request interface with timing information
 */
interface TimedRequest extends Request {
  startTime?: number;
  requestId?: string;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get request size in bytes
 */
function getRequestSize(req: Request): number {
  let size = 0;
  
  // Add headers size (rough estimate)
  if (req.headers) {
    size += JSON.stringify(req.headers).length;
  }
  
  // Add body size if present
  if (req.body) {
    size += JSON.stringify(req.body).length;
  }
  
  return size;
}

/**
 * Get response size in bytes
 */
function getResponseSize(res: Response): number {
  const contentLength = res.get('content-length');
  return contentLength ? parseInt(contentLength, 10) : 0;
}

/**
 * Sanitize sensitive data from logs
 */
function sanitizeData(data: any): any {
  const sensitiveFields = [
    'password', 'token', 'authorization', 'cookie', 'session',
    'secret', 'key', 'apikey', 'api_key', 'auth', 'passwd'
  ];
  
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = { ...data };
  
  for (const field of sensitiveFields) {
    if (field.toLowerCase() in sanitized) {
      sanitized[field.toLowerCase()] = '[REDACTED]';
    }
    
    // Check case variations
    Object.keys(sanitized).forEach(key => {
      if (key.toLowerCase().includes(field)) {
        sanitized[key] = '[REDACTED]';
      }
    });
  }
  
  return sanitized;
}

/**
 * Determine log level based on response status
 */
function getLogLevel(statusCode: number): 'info' | 'warn' | 'error' {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  return 'info';
}

/**
 * Request logging middleware
 */
export const requestLogger = (req: TimedRequest, res: Response, next: NextFunction): void => {
  // Add request start time and ID
  req.startTime = Date.now();
  req.requestId = generateRequestId();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);
  
  // Log request start (only in debug mode to avoid spam)
  if (process.env.LOG_LEVEL === 'debug') {
    apiLogger.debug('Request started', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      requestSize: getRequestSize(req),
    });
  }
  
  // Capture original res.end to log when response completes
  const originalEnd = res.end;
  
  res.end = function(chunk?: any, encoding?: any, cb?: any): any {
    // Calculate request duration
    const duration = Date.now() - (req.startTime || Date.now());
    const statusCode = res.statusCode;
    const logLevel = getLogLevel(statusCode);
    
    // Prepare log data
    const logData = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      requestSize: getRequestSize(req),
      responseSize: getResponseSize(res),
      referer: req.get('Referer'),
    };
    
    // Add query parameters (sanitized)
    if (req.query && Object.keys(req.query).length > 0) {
      (logData as any).query = sanitizeData(req.query);
    }
    
    // Add request body for POST/PUT requests (sanitized and truncated)
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      const sanitizedBody = sanitizeData(req.body);
      const bodyStr = JSON.stringify(sanitizedBody);
      (logData as any).body = bodyStr.length > 1000 ? 
        bodyStr.substring(0, 1000) + '...[truncated]' : 
        sanitizedBody;
    }
    
    // Log based on status code
    if (logLevel === 'error') {
      apiLogger.error('Request completed with error', logData);
    } else if (logLevel === 'warn') {
      apiLogger.warn('Request completed with warning', logData);
    } else {
      apiLogger.info('Request completed', logData);
    }
    
    // Log performance metrics
    perfLogger.logRequest(req.method, req.originalUrl, duration, statusCode);
    
    // Log slow requests
    if (duration > 1000) { // Requests taking more than 1 second
      apiLogger.warn('Slow request detected', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode,
      });
    }
    
    // Call original end function
    return originalEnd.call(this, chunk, encoding, cb);
  };
  
  next();
};

/**
 * Error request logger - logs requests that resulted in errors
 */
export const errorRequestLogger = (error: Error, req: TimedRequest, res: Response, next: NextFunction): void => {
  const duration = Date.now() - (req.startTime || Date.now());
  
  apiLogger.error('Request failed with error', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    error: error.message,
    stack: error.stack,
    duration: `${duration}ms`,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method !== 'GET' ? sanitizeData(req.body) : undefined,
  });
  
  next(error);
};

/**
 * Health check logger - minimal logging for health endpoints
 */
export const healthCheckLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Skip detailed logging for health checks to reduce noise
  if (req.path === '/health' || req.path === '/ping') {
    return next();
  }
  
  return requestLogger(req as TimedRequest, res, next);
};

/**
 * API request statistics middleware
 */
export const requestStatsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Capture response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log API statistics
    apiLogger.info('API Stats', {
      endpoint: `${req.method} ${req.route?.path || req.path}`,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString(),
      type: 'api_stats'
    });
  });
  
  next();
};

/**
 * Security audit logger for sensitive operations
 */
export const securityAuditLogger = (operation: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const logData = {
      operation,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      type: 'security_audit'
    };
    
    // Log before operation
    apiLogger.info('Security operation attempted', logData);
    
    // Capture response to log result
    const originalSend = res.send;
    res.send = function(data: any): any {
      apiLogger.info('Security operation completed', {
        ...logData,
        statusCode: res.statusCode,
        success: res.statusCode < 400
      });
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

export default requestLogger; 