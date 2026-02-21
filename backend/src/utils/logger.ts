import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(logColors);

// Create logs directory if it doesn't exist
const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    let logMessage = `${timestamp} ${level}: ${message}`;
    if (stack) {
      logMessage += `\n${stack}`;
    }
    return logMessage;
  })
);

// Get log level from environment or default to 'info'
const logLevel = process.env.LOG_LEVEL || 'info';

// Create transports array
const transports: winston.transport[] = [
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(logsDir, 'app.log'),
    level: logLevel,
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true,
  }),
  
  // Separate file for errors
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true,
  }),
];

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      level: logLevel,
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true,
    })
  );
}

// Create the logger instance
export const logger = winston.createLogger({
  levels: logLevels,
  level: logLevel,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Create specialized loggers for different modules
export const createModuleLogger = (moduleName: string) => {
  return {
    error: (message: string, ...meta: any[]) => 
      logger.error(`[${moduleName}] ${message}`, ...meta),
    warn: (message: string, ...meta: any[]) => 
      logger.warn(`[${moduleName}] ${message}`, ...meta),
    info: (message: string, ...meta: any[]) => 
      logger.info(`[${moduleName}] ${message}`, ...meta),
    debug: (message: string, ...meta: any[]) => 
      logger.debug(`[${moduleName}] ${message}`, ...meta),
  };
};

// Database logger
export const dbLogger = createModuleLogger('DATABASE');

// AI logger
export const aiLogger = createModuleLogger('AI');

// Plugin logger
export const pluginLogger = createModuleLogger('PLUGIN');

// API logger
export const apiLogger = createModuleLogger('API');

// WebSocket logger
export const wsLogger = createModuleLogger('WEBSOCKET');

// Performance logger for monitoring
export const perfLogger = {
  logRequest: (method: string, url: string, duration: number, statusCode: number) => {
    logger.info('Request completed', {
      method,
      url,
      duration: `${duration}ms`,
      statusCode,
      type: 'performance',
    });
  },
  
  logAIRequest: (provider: string, model: string, tokens: number, duration: number) => {
    logger.info('AI request completed', {
      provider,
      model,
      tokens,
      duration: `${duration}ms`,
      type: 'ai_performance',
    });
  },
  
  logDatabaseQuery: (query: string, duration: number, rowCount?: number) => {
    logger.debug('Database query completed', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rowCount,
      type: 'database_performance',
    });
  },
};

// Security logger for audit trails
export const securityLogger = {
  logAuthAttempt: (success: boolean, ip: string, userAgent?: string) => {
    logger.info('Authentication attempt', {
      success,
      ip,
      userAgent,
      type: 'security',
    });
  },
  
  logRateLimitHit: (ip: string, endpoint: string) => {
    logger.warn('Rate limit exceeded', {
      ip,
      endpoint,
      type: 'security',
    });
  },
  
  logSuspiciousActivity: (description: string, ip: string, details?: any) => {
    logger.warn('Suspicious activity detected', {
      description,
      ip,
      details,
      type: 'security',
    });
  },
};

// Export logger as default
export default logger; 